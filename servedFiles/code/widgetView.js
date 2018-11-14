class widgetView {
  // containerDOM: the object which the view widget will be inside.
  // nodeID: the ID of the node being viewed
  // relationType: Whether this view is of start, end or peer (not implemented) relations
  // object and objectMethod: Kludgy code enabling the widgetView to call a function in another class after running a query.
  // objectMethod is the method to call and object is the object containing it. I may eliminate these.
  // userRequest is the number of the user request which created the widgetNode which originally created this widgetView.
  // It is therefore also the number of the user request which should be associated with this view's initial queries.
  constructor(containerDOM, nodeID, relationType, userRequest, object, objectMethod, ...args) {
    this.relations = {}; // Will store GUIDs as keys and DOM objects as values
    this.activeDOM = null; // Will store the DOM object for the relation currently shown
    this.activeToggle = null; // Will store the toggle button for the relation currently shown

    this.relationType = relationType;
    this.nodeID = nodeID;
    this.containerDOM = containerDOM;
    this.object = object;
    this.objectMethod = objectMethod;
    this.args = args;

    this.id = app.idCounter++;  // Add to app.widgets
    app.widgets[this.id] = this;

    this.containerDOM.setAttribute("id", this.id.toString()); // Make the container a widget element and give it an ID
    this.containerDOM.setAttribute("class", "widget");

    this.containedWidgets = []; // Smaller widgets (so far, only views shown by widgetRelations) contained in this widget
    this.rows = 0; // Number of rows shown in the view table (each row represents one person's view).
    this.widgetTable = null; // The table containing a list of people with views, and possibly an active view
    this.viewTable = null; // A table of active views, which goes inside this.widgetTable
    this.relCell = null; // The cell of this.widgetTable which contains the active view (if any), and any previously active views (hidden)
    this.add = null; // The "Add Me" button, which is visible when a user is logged in but doesn't have a view of this node

    const obj = {};
    obj.from = {"name":"user"};
    obj.rel = {"type":"View", "return":false};
    obj.to = {"id":nodeID, "return":false};

    app.REST.sendQuery(obj, "changeRelation", "Searching for views", userRequest, this.containerDOM, null, null, this.buildViews.bind(this));
  }

  // Adds the view widget to the page: A list of views, possibly an active view,
  // and an "Add Me" button that may or may not be visible.
  buildViews(data, userRequest) {
    // Log data first, so if any relations are created this will show up first
    const obj = {};
    obj.data=JSON.parse(JSON.stringify(data));
    app.stripIDs(obj.data);
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);

    // If there was already a widget in the containerDOM (we are refreshing), delete it
    if (this.widgetTable) {
      this.containerDOM.removeChild(this.widgetTable);
    }

    // The widget will consist of a table with two cells. One will contain the HTML being built here, and the other will be empty at first, and then store whatever relation is shown.
    // The cell with the views will be the one closer to the node - the left-hand one for start and the right-hand one for end.
    this.widgetTable = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    this.widgetTable.appendChild(tbody);
    tbody.appendChild(row);
    this.containerDOM.appendChild(this.widgetTable);

    // Go ahead and create the cells for the table and relation, and append them in the correct order.
    this.relCell = document.createElement('td');
    this.relCell.setAttribute("idr", "relationsDOM");

    const tableCell = document.createElement('td'); // This cell will contain the list of views

    // Build the toggle and refresh buttons (they go in the table cell with the list of views)
    this.toggleButton = document.createElement('input');
    this.toggleButton.setAttribute("type", "button");
    this.toggleButton.setAttribute("idr", "toggle");
    this.toggleButton.setAttribute("value", "__");
    this.toggleButton.setAttribute("onclick", "app.widget('toggle', this)");
    tableCell.appendChild(this.toggleButton);

    const refresh = document.createElement('input');
    refresh.setAttribute("type", "button");
    refresh.setAttribute("idr", "refresh");
    refresh.setAttribute("value", "Refresh");
    refresh.setAttribute("onclick", "app.widget('refresh', this)");
    tableCell.appendChild(refresh);

    const summary = document.createElement('input');
    summary.setAttribute("type", "button");
    summary.setAttribute("idr", "summary");
    summary.setAttribute("value", "Summary");
    summary.setAttribute("onclick", "app.widget('summary', this)");
    tableCell.appendChild(summary);


    if (this.relationType === "start") { // Should see this order:  end relations, end view, node, start view, start relations
      row.appendChild(tableCell);
      row.appendChild(this.relCell);
    }
    else if (this.relationType === "end") {
      row.appendChild(this.relCell);
      row.appendChild(tableCell);
    }

    // Create the "Add Me" button. It starts off hidden if no one is logged in, visible if someone is.
    // It's not appended yet because it goes beneath the table of views in the table cell.
    this.add = document.createElement("input");
    this.add.setAttribute("type", "button");
    this.add.setAttribute("idr", "addMe");
    this.add.setAttribute("value", "Add Me");
    this.add.setAttribute("onclick", "app.widget('addUser', this)");
    if (app.login.userID === null) {
      this.add.classList.add("hidden");
    }

    // build the table of views, to go in the tableCell.
    this.viewTable = document.createElement('table');
    const innerThead = document.createElement('thead');
    const innerTbody = document.createElement('tbody');
    this.viewTable.appendChild(innerThead);
    this.viewTable.appendChild(innerTbody);

    // Once the viewTable is made, append it and the add button
    tableCell.appendChild(this.viewTable);
    tableCell.appendChild(this.add);

    // Remember, the cells in widgetTable go in different orders for start and end relations,
    // because start relations are on the right and end relations are on the left.
    // Cells in viewTable are also mirrored, so that the ID is always next to the node (in the center),
    // and the Show is always next to the active view, if any (on the edge).
    if (this.relationType === 'start') {
      innerThead.innerHTML = `<tr><th>ID</th><th>Name</th><th>Show</th></tr>`;
    }
    else if (this.relationType === 'end') {
      innerThead.innerHTML = `<tr><th>Show</th><th>Name</th><th>ID</th></tr>`;
    }
    else {
      alert ("Error: Relation type not defined");
    }

    for (let i in data) { // Create a row in the table of views for each person who has a view.
      const innerRow = document.createElement('tr');

      // Each row contains the person's ID...
      const IDcell = document.createElement('td');
      const ID = document.createTextNode(`${data[i].user.id}`);
      IDcell.appendChild(ID);
      IDcell.setAttribute("idr", `id${i}`);
      IDcell.setAttribute("GUID", data[i].user.properties.M_GUID);

      // their name...
      const nameCell = document.createElement('td');
      const name = document.createTextNode(`${data[i].user.properties.name}`)
      nameCell.appendChild(name);

      // and a button to toggle their view.
      const buttonCell = document.createElement('td');
      const button = document.createElement('input');
      button.setAttribute("type", "button");
      button.setAttribute("idr", `showRelations${i}`);
      button.setAttribute("value", "+");
      button.setAttribute("onclick", "app.widget('toggleRelation', this)");
      buttonCell.appendChild(button);

      // Append the cells in the correct order (remember, ID in the center, toggle button on the edge)
      if (this.relationType === 'start') {
        innerRow.appendChild(IDcell);
        innerRow.appendChild(nameCell);
        innerRow.appendChild(buttonCell);
      }
      else if (this.relationType === 'end') {
        innerRow.appendChild(buttonCell);
        innerRow.appendChild(nameCell);
        innerRow.appendChild(IDcell);
      }
      innerTbody.appendChild(innerRow);

      const dataID = data[i].user.id;
      if (app.login.userID && app.login.userID == dataID) {      // if this row represents the logged-in user...
        innerRow.classList.add("loggedIn", "selectedItem");            // format it...
        nameCell.setAttribute("idr", "loggedInView");                // give the cell with their name an idr, so it can be logged and replayed...
        nameCell.setAttribute("ondrop", "app.widget('drop', this, event)")  // give the cell with their name an ondrop, so data can be dropped in...
        nameCell.setAttribute("ondragover", "event.preventDefault()"); // and an ondragover, so data can be dropped...
        this.add.classList.add("hidden");                            // hide the "Add Me" button because the user is already shown...
        this.toggleRelation(button, userRequest);                                 // and automatically show their view.
      }

      this.rows++; // update the number of rows shown in the table
    } // end for (building table one row at a time)

    if (this.relationType === "end") {
      this.toggle(); // Default is to hide end relations
    }
    if (this.object && this.objectMethod) { // If an object and object method were passed in, run them, then delete them so they don't run a second time.
      this.object[this.objectMethod](userRequest, ...this.args);
      this.object = null;
      this.objectMethod = null;
    }
  }

  // Toggles the relation represented by the button.
  // If a relation was already visible and this method is used to show a new one, the first one is hidden.
  toggleRelation(button, userRequest) {
    if (button.value == "+") { // we are opening a relation
      button.value = "__";
      // Hide any relation that's already active
      if (this.activeDOM) {
        this.activeDOM.setAttribute("hidden", "true");
      }
      // Remove formatting from the old active row and change the active toggle button back to +
      if (this.activeToggle) {
        const activeRow = this.activeToggle.parentElement.parentElement; // activeToggle is in a cell which is in a row
        activeRow.classList.remove("selectedItem");
        this.activeToggle.setAttribute("value", "+");
      }

      // Get the ID associated with this button
      const row = button.parentElement.parentElement;
      const rowNum = button.getAttribute("idr").substring(13);
      const idCell = app.domFunctions.getChildByIdr(row, `id${rowNum}`);
      const GUID = idCell.getAttribute("GUID");

      // See whether the view already exists
      if (GUID in this.relations) {
        this.relations[GUID].removeAttribute("hidden"); // If so, just make it visible and active.
        this.activeDOM = this.relations[GUID];
      }
      else { // If not, create it in a new div and append it to relCell.
        const relDOM = document.createElement('div');
        this.relCell.appendChild(relDOM);
        this.containedWidgets.push(app.idCounter);

        if (!userRequest) {
          userRequest = app.REST.startUserRequest("Saving node", this.containerDOM);
        }
        new widgetRelations(relDOM, this.nodeID, GUID, this.relationType, userRequest); // Creates a new widgetRelations object in relDOM
        this.relations[GUID] = relDOM;
        this.activeDOM = relDOM;
      }
      this.activeToggle = button;

      // Format the row
      row.classList.add("selectedItem");
    } // end if (opening a relation)
    else { // we are closing a relation
      button.value = "+";

      // Hide the active relation
      this.activeDOM.setAttribute("hidden", "true");

      // Remove formatting from the old active row
      const activeRow = button.parentElement.parentElement;
      activeRow.classList.remove("selectedItem");

      // reset active relation and toggle to null
      this.activeDOM = null;
      this.activeToggle = null;
    }

    // If a button was clicked, whether to open or close a relation, log it.
    const obj = {};
    obj.id = app.domFunctions.widgetGetId(button);
    obj.idr = button.getAttribute("idr");
    obj.action = "click";
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  // refreshes the widget by removing all existing relations,
  // querying the database again to get up-to-date information on who has a view, and rebuilding the table.
  refresh(data, userRequest) {
    this.relations = {}; // reset list of existing relation DOM objects
    // Get the IDs and names of all the people with views of this node, and pass them to buildViews.
    const obj = {};
    obj.from = {"name":"user"};
    obj.rel = {"type":"View", "return":false};
    obj.to = {"id":this.nodeID, "return":false};

    if (!userRequest) {
      userRequest = app.REST.startUserRequest("Refreshing view", this.containerDOM);
    }

    app.REST.sendQuery(obj, "changeRelation", "Searching for views", userRequest, this.containerDOM, null, null, this.buildViews.bind(this));
  }

  // Expands or collapses the whole widget.
  toggle (button) {
    if (!button) { // Defaults to assuming the toggle button for the widget was clicked
      button = this.toggleButton;
    }

    if (button.value ==="+") { // If we're expanding
      button.value = "__";

      // Show all the button's siblings
      let sibling = button.nextElementSibling;
      while (sibling) {
        sibling.hidden = false;
        sibling = sibling.nextElementSibling;
      }
      this.relCell.hidden = false;
    }

    else { // we're collapsing
      button.value = "+";

      // Hide all the button's siblings
      let sibling = button.nextElementSibling;
      while (sibling) {
        sibling.hidden = true;
        sibling = sibling.nextElementSibling;
      }
      this.relCell.hidden = true;
    }

    // log
    const obj = {};
    obj.id = app.domFunctions.widgetGetId(button);
    obj.idr = button.getAttribute("idr");
    obj.action = "click";
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  // Drops data from one view into another. You can only drop into your own view (other views don't have this as an ondrop)
  // viewName isn't used as far as I can see, but the way app.widget (which calls this) works, you have to pass on the DOM
  // object that called the method whether you use it or not.
  drop(viewName, evnt) {
    const dataText = evnt.dataTransfer.getData("text/plain");
    const data = JSON.parse(dataText);

    // Only continue if the object being dragged is a row from a widgetRelations object (representing someone else's view)
    // or a row from some other dragDrop table (representing your view of something else)
    if (data.sourceType == "widgetRelations" && data.sourceTag == "TR" ||
        data.sourceType == "dragDrop" && data.sourceTag == "TR" && data.sourceID != this.id) {
      let comment = ""; // The other person may not have added a comment. If not, it should be "" rather than undefined.
      if ('comment' in data) {
        comment = data.comment;
      }

      const userViewDOM = this.relations[app.login.userGUID]; // DOM element containing the user's view
      const dragDropDOM = userViewDOM.lastElementChild; // The dragDrop widget
      const dragDropID = dragDropDOM.getAttribute("id");
      const dragDropObj = app.widgets[dragDropID];  // The javascript object for the dragDrop widget

      const tbody = app.domFunctions.getChildByIdr(dragDropDOM, "container");
      const inputRow = app.domFunctions.getChildByIdr(tbody, "insertContainer"); // The row in the relations widget containing inputs. Anything dropped into the widget will appear just before this row.

      // Create new row in dragDrop table. All "this" references are to dragDrop or dragDropTable
      const row = document.createElement('tr');
      row.setAttribute("idr", `item${dragDropObj.itemCount}`); // Assign an idr
      row.setAttribute("ondrop", "app.widget('dropData', this, event)"); // Assign drag and drop methods
      row.setAttribute("ondragover", "event.preventDefault()");
      row.setAttribute("draggable", "true");
      row.setAttribute("ondragstart", "app.widget('drag', this, event)");

      const html = `<td></td>
                    <td hidden></td><td hidden>${data.nodeID}</td>
                    <td idr="content${dragDropObj.contentCount++}">${data.name}</td>
                    <td>${data.type}</td>
                    <td ondblclick="app.widget('edit', this, event)" idr="content${dragDropObj.contentCount++}">${comment}</td>
                    <td><input type="button" idr="delete${dragDropObj.itemCount++}" value="Delete" onclick="app.widget('delete', this)"></td>`

      row.innerHTML = html;
      row.classList.add("newData");
      tbody.insertBefore(row, inputRow);

      if (app.activeWidget) {
        app.activeWidget.classList.remove("activeWidget");
      }
      app.activeWidget = this.containerDOM;
      this.containerDOM.classList.add("activeWidget");


      //log
      const obj = {};
      obj.id = app.domFunctions.widgetGetId(viewName);
      obj.idr = viewName.getAttribute("idr");
      obj.action = "drop";
      app.regression.log(JSON.stringify(obj));
      app.regression.record(obj);
    }
  }

  // the event doesn't take its default action
  allowDrop(input, evnt){
    evnt.preventDefault();
  }

  // Adds a new view link between the node being viewed and the logged-in user, then calls refresh
  addUser(button) {
    // Create a view of this node for this user
    const obj = {};
    obj.from = {"properties":{"M_GUID":app.login.userGUID}};
    obj.to = {"id":this.nodeID};
    obj.rel = {"type":"View", "merge":true};

    const userRequest = app.REST.startUserRequest("Adding your view", this.containerDOM);

    app.REST.sendQuery(obj, "changeRelation", "Adding your view", userRequest, this.containerDOM, null, null, this.refresh.bind(this));

    // Log click
    const recordObj = {};
    recordObj.id = app.domFunctions.widgetGetId(button);
    recordObj.idr = button.getAttribute("idr");
    recordObj.action = "click";
    app.regression.log(JSON.stringify(recordObj));
    app.regression.record(recordObj);
  }

  summary() {
    // Hide any relation that's already active
    if (this.activeDOM) {
      this.activeDOM.setAttribute("hidden", "true");
    }
    // Remove formatting from the old active row and change the active toggle button back to +
    if (this.activeToggle) {
      const activeRow = this.activeToggle.parentElement.parentElement; // activeToggle is in a cell which is in a row
      activeRow.classList.remove("selectedItem");
      this.activeToggle.setAttribute("value", "+");
      this.activeToggle = null;
    }

    // See whether the view already exists
    if ('summary' in this.relations) {
      this.relations.summary.removeAttribute("hidden"); // If so, just make it visible and active.
      this.activeDOM = this.relations.summary;
    }
    else { // If not, create it in a new div and append it to relCell.
      const relDOM = document.createElement('div');
      this.relCell.appendChild(relDOM);
      this.containedWidgets.push(app.idCounter);

      const userRequest = app.REST.startUserRequest("Saving node", this.containerDOM);
      new widgetRelations(relDOM, this.nodeID, 'summary', this.relationType, userRequest); // Creates a new widgetRelations object in relDOM
      this.relations.summary = relDOM;
      this.activeDOM = relDOM;
    }
  }
}
