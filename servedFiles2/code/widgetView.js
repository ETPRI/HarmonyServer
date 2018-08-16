class widgetView {
  // containerDOM: the object which the view widget will be inside.
  // nodeID: the ID of the node being viewed
  // relationType: Whether this view is of start, end or peer (not implemented) relations
  // object and objectMethod: Kludgy code enabling the widgetView to call a function in another class after running a query.
  // objectMethod is the method to call and object is the object containing it. I may eliminate these.
  constructor(containerDOM, nodeID, relationType, object, objectMethod) {
    this.relations = {}; // Will store IDs as keys and DOM objects as values
    this.activeDOM = null; // Will store the DOM object for the relation currently shown
    this.activeToggle = null; // Will store the toggle button for the relation currently shown

    this.relationType = relationType;
    this.nodeID = nodeID;
    this.containerDOM = containerDOM;
    this.object = object;
    this.objectMethod = objectMethod;

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
    obj.start = {};
    obj.start.name = "user";
    obj.middle = {};
    obj.middle.type = "View";
    obj.middle.properties = {};
    obj.middle.properties.direction = relationType;
    obj.middle.return = false;
    obj.end = {};
    obj.end.id = nodeID;
    obj.end.return = false;
    obj.rel1 = {};
    obj.rel1.type = "Owner";
    obj.rel1.return = false;
    obj.rel2 = {};
    obj.rel2.type = "Subject";
    obj.rel2.return = false;
    app.nodeFunctions.changeTwoRelPattern(obj, this, 'buildViews');
  }

  // Adds the view widget to the page: A list of views, possibly an active view,
  // and an "Add Me" button that may or may not be visible.
  buildViews(data) {
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
    const toggle = document.createElement('input');
    toggle.setAttribute("type", "button");
    toggle.setAttribute("idr", "toggle");
    toggle.setAttribute("value", "__");
    toggle.setAttribute("onclick", "app.widget('toggle', this)");
    tableCell.appendChild(toggle);

    const refresh = document.createElement('input');
    refresh.setAttribute("type", "button");
    refresh.setAttribute("idr", "refresh");
    refresh.setAttribute("value", "refresh");
    refresh.setAttribute("onclick", "app.widget('refresh', this)");
    tableCell.appendChild(refresh);

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
        innerRow.classList.add("loggedIn", "activeView");            // format it...
        nameCell.setAttribute("idr", "loggedInView");                // give the cell with their name an idr, so it can be logged and replayed...
        nameCell.setAttribute("ondrop", "app.widget('drop', this, event)")  // give the cell with their name an ondrop, so data can be dropped in...
        nameCell.setAttribute("ondragover", "app.widget('allowDrop', this, event)"); // and an ondragover, so data can be dropped...
        this.add.classList.add("hidden");                            // hide the "Add Me" button because the user is already shown...
        this.toggleRelation(button);                                 // and automatically show their view.
      }

      this.rows++; // update the number of rows shown in the table
    } // end for (building table one row at a time)

    // After everything is built:
    const loginObj = {};  // Add an object describing a call to this.onLogin() to the doOnLogin array
    loginObj.object = this;
    loginObj.method = "onLogin";
    loginObj.args = [];
    app.login.doOnLogin.push(loginObj);

    const logoutObj = {}; // Add an object describing a call to this.onLogout() to the doOnLogout array
    logoutObj.object = this;
    logoutObj.method = "onLogout";
    logoutObj.args = [];
    app.login.doOnLogout.push(logoutObj);

    if (this.object && this.objectMethod) { // If an object and object method were passed in, run them, then delete them so they don't run a second time.
      this.object[this.objectMethod]();
      this.object = null;
      this.objectMethod = null;
    }
  }

  // Toggles the relation represented by the button.
  // If a relation was already visible and this method is used to show a new one, the first one is hidden.
  toggleRelation(button) {
    if (button.value == "+") { // we are opening a relation
      button.value = "__";
      // Hide any relation that's already active
      if (this.activeDOM) {
        this.activeDOM.setAttribute("hidden", "true");
      }
      // Remove formatting from the old active row and change the active toggle button back to +
      if (this.activeToggle) {
        const activeRow = this.activeToggle.parentElement.parentElement; // activeToggle is in a cell which is in a row
        activeRow.classList.remove("activeView");
        this.activeToggle.setAttribute("value", "+");
      }

      // Get the ID associated with this button
      const row = button.parentElement.parentElement;
      const rowNum = button.getAttribute("idr").substring(13);
      const idCell = app.domFunctions.getChildByIdr(row, `id${rowNum}`);
      const ID = idCell.textContent;

      // See whether the view already exists
      if (ID in this.relations) {
        this.relations[ID].removeAttribute("hidden"); // If so, just make it visible and active.
        this.activeDOM = this.relations[ID];
      }
      else { // If not, create it in a new div and append it to relCell.
        const relDOM = document.createElement('div');
        this.relCell.appendChild(relDOM);
        this.containedWidgets.push(app.idCounter);
        new widgetRelations(relDOM, this.nodeID, ID, this.relationType); // Creates a new widgetRelations object in relDOM
        this.relations[ID] = relDOM;
        this.activeDOM = relDOM;
      }
      this.activeToggle = button;

      // Format the row
      row.classList.add("activeView");
    } // end if (opening a relation)
    else { // we are closing a relation
      button.value = "+";

      // Hide the active relation
      this.activeDOM.setAttribute("hidden", "true");

      // Remove formatting from the old active row
      const activeRow = button.parentElement.parentElement;
      activeRow.classList.remove("activeView");

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
  refresh(button) {
    this.relations = {}; // reset list of existing relation DOM objects
    // Get the IDs and names of all the people with views of this node, and pass them to buildViews.
    const obj = {};
    obj.start = {};
    obj.start.name = "user";
    obj.middle = {};
    obj.middle.type = "View";
    obj.middle.properties = {};
    obj.middle.properties.direction = this.relationType;
    obj.middle.return = false;
    obj.end = {};
    obj.end.id = this.nodeID;
    obj.end.return = false;
    obj.rel1 = {};
    obj.rel1.type = "Owner";
    obj.rel1.return = false;
    obj.rel2 = {};
    obj.rel2.type = "Subject";
    obj.rel2.return = false;
    app.nodeFunctions.changeTwoRelPattern(obj, this, 'buildViews');

    // log click
    const recordObj = {};
    recordObj.id = app.domFunctions.widgetGetId(button);
    recordObj.idr = button.getAttribute("idr");
    recordObj.action = "click";
    app.regression.log(JSON.stringify(recordObj));
    app.regression.record(recordObj);
  }

  // Expands or collapses the whole widget.
  toggle (button) {
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

      const userViewDOM = this.relations[app.login.userID]; // DOM element containing the user's view
      const dragDropDOM = userViewDOM.lastElementChild; // The dragDrop widget
      const dragDropID = dragDropDOM.getAttribute("id");
      const dragDropObj = app.widgets[dragDropID];  // The javascript object for the dragDrop widget

      const tbody = app.domFunctions.getChildByIdr(dragDropDOM, "container");
      const inputRow = app.domFunctions.getChildByIdr(tbody, "insertContainer"); // The row in the relations widget containing inputs. Anything dropped into the widget will appear just before this row.

      // Create new row
      const row = document.createElement('tr');
      row.setAttribute("idr", `item${dragDropObj.itemCount}`); // Assign an idr
      row.setAttribute("ondrop", "app.widget('drop', this, event)"); // Assign drag and drop methods
      row.setAttribute("ondragover", "app.widget('allowDrop', this, event)");
      row.setAttribute("draggable", "true");
      row.setAttribute("ondragstart", "app.widget('drag', this, event)");

      const html = `<td></td>
                    <td></td>
                    <td ondragover="app.widget('allowDrop', this, event)" ondrop="app.widget('dropData', this, event)" idr="content${dragDropObj.contentCount++}">${data.nodeID}</td>
                    <td ondragover="app.widget('allowDrop', this, event)" ondrop="app.widget('dropData', this, event)" idr="content${dragDropObj.contentCount++}">${data.name}</td>
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

  // Adds a new view to the database linked to the node being viewed and the logged-in user, then calls addComplete
  addUser(button) {
    // Create a view of this node for this user
    const obj = {};
    obj.name = "view";
    obj.type = "View";
    obj.properties = {};
    obj.properties.direction = this.relationType;
    app.nodeFunctions.createNode(obj, this, 'linkViewUser');

    // Log click
    const recordObj = {};
    recordObj.id = app.domFunctions.widgetGetId(button);
    recordObj.idr = button.getAttribute("idr");
    recordObj.action = "click";
    app.regression.log(JSON.stringify(recordObj));
    app.regression.record(recordObj);
  }

  linkViewUser(data) { // Take the newly-created node and connect it to the user
    const viewID = data[0].view.id;

    const obj = {};
    obj.from = {};
    obj.from.id = app.login.userID;
    obj.from.return = false;
    obj.to = {};
    obj.to.id = viewID;
    obj.to.return = false;
    obj.rel = {};
    obj.rel.type = "Owner";
    obj.rel.return = false;
    app.nodeFunctions.createRelation(obj, this, 'linkViewNode', viewID);
  }

  linkViewNode(data, viewID) { // Connect the new view to the node and move on to addComplete
    const obj = {};
    obj.from = {};
    obj.from.id = viewID;
    obj.from.return = false;
    obj.to = {};
    obj.to.id = this.nodeID;
    obj.to.return = false;
    obj.rel = {};
    obj.rel.type = "Subject";
    obj.rel.return = false;
    app.nodeFunctions.createRelation(obj, this, 'addComplete');
  }

  // Updates the page after a new view is added, by adding a row for the new view to the table of views,
  // formatting it (because it must belong to the logged-in user) and automatically opening it.
  addComplete(data) {
    // Add a row to the table for this user
    const innerRow = document.createElement('tr');

    const IDcell = document.createElement('td');
    const ID = document.createTextNode(`${app.login.userID}`);
    IDcell.appendChild(ID);
    IDcell.setAttribute("idr", `id${this.rows}`);

    const buttonCell = document.createElement('td');
    const button = document.createElement('input');
    button.setAttribute("type", "button");
    button.setAttribute("idr", `showRelations${this.rows++}`);  // Done using this.rows for this row, so increment it to be ready for the next one
    button.setAttribute("value", "+"); // Let the cell start with a "+" so this.toggleRelation will know it's OPENING something.
    button.setAttribute("onclick", "app.widget('toggleRelation', this)");
    buttonCell.appendChild(button);

    const nameCell = document.createElement('td');
    const name = document.createTextNode(`${app.login.userName}`)
    nameCell.appendChild(name);

    // Append the cells in the right order (ID in the center, button on the edge)
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

    this.viewTable.lastElementChild.appendChild(innerRow); // Append the new row to the tbody of the table of views

    innerRow.classList.add("loggedIn", "activeView");            // format the row (because it must belong to the logged-in user)...
    nameCell.setAttribute("idr", "loggedInView");                // give the cell with their name an idr, so it can be logged and replayed...
    nameCell.setAttribute("ondrop", "app.widget('drop', this, event)")  // give the cell with their name an ondrop, so data can be dropped in...
    nameCell.setAttribute("ondragover", "app.widget('allowDrop', this, event)");  // and an ondragover, so the data can be dropped...
    this.add.classList.add("hidden");                            // hide the "Add Me" button because the user is already shown...
    this.toggleRelation(button);                                 // and automatically show their view.

    // Log
    const obj = {};
    obj.data = data;
    app.stripIDs(obj.data);
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  // Code to run whenever a user logs in. It shows the Add Me button if this user doesn't have a view,
  // or formats and automatically opens their view if they do.
  onLogin() {
    // Show Add Me button
    this.add.classList.remove("hidden");

    //Figure out which column is which...
    let IDcolumn;
    let toggleColumn;
    if (this.relationType == "start") {
      IDcolumn = 0;
      toggleColumn = 2;
    }
    else if (this.relationType == "end") {
      toggleColumn = 0;
      IDcolumn = 2;
    }

    // then look for the logged-in user's view, if any, by checking the ID column for their ID.
    const tbody = this.viewTable.lastElementChild;
    const rows = Array.from(tbody.children); // Get array of all rows in the view table (each row is a person's view)
    for (let i=0; i<rows.length; i++) {
      const IDcell = rows[i].children[IDcolumn]; // Check the ID cell of each row.
      const ID = IDcell.textContent;
      if (ID == app.login.userID) {                          // If the ID for this row matches the logged-in user...
        const toggleCell = rows[i].children[toggleColumn];
        const nameCell = rows[i].children[1];

        rows[i].classList.add("loggedIn", "activeView");             // format it...
        nameCell.setAttribute("idr", "loggedInView");                // give the cell with their name an idr, so it can be logged and replayed...
        nameCell.setAttribute("ondrop", "app.widget('drop', this, event)")  // give the cell with their name an ondrop, so data can be dropped in...
        nameCell.setAttribute("ondragover", "app.widget('allowDrop', this, event)");  // and an ondragover, so data can be dropped...
        this.add.classList.add("hidden");                            // hide the "Add Me" button because the user is already shown...

        // Close their view if it was already open (so that when it reopens, it will look like a logged-in view).
        // Remove it from the cache. Then automatically open their view.
        const toggleButton = toggleCell.firstElementChild;
        if (toggleButton.value === "__") { // If the user's view is open, then their toggle button will say "__".
          this.toggleRelation(toggleButton); // Close it
        }
        if (ID in this.relations) { // If this user's view was cached...
          const relDOM = this.relations[ID];
          this.relCell.removeChild(relDOM);
          delete this.relations[ID]; // Remove it both from the page and the array of cached views
        }

        this.toggleRelation(toggleButton); // Open the user's view
      } // end if (row matches logged-in user)
    } // end for (all rows)
  } // end onLogin

  // Code to run when a user logs out. It resets the table by removing all existing views,
  // removing formatting from the logged-in user's view, if any, and hiding the "Add Me" button.
  onLogout() {
    // Hide "Add Me" button
    this.add.classList.add("hidden");

    // Remove all relations from the DOM and the relations object
    for (let ID in this.relations) {
      const relDOM = this.relations[ID];
      this.relCell.removeChild(relDOM);
    }
    this.relations = {};

    // No view should be active when this is done, so activeDOM and activeToggle are null.
    this.activeDOM = null;
    this.activeToggle = null;

    let toggleColumn;
    if (this.relationType == "start") {
      toggleColumn = 2;
    }
    else if (this.relationType == "end") {
      toggleColumn = 0;
    }

    // Go through the views table. Make sure all toggle buttons say "+" rather than "__",
    // and turn the active view and the logged-in users view, if they exist, back into ordinary views.
    const tbody = this.viewTable.lastElementChild;
    const rows = Array.from(tbody.children);
    for (let i=0; i<rows.length; i++) {
      const toggleCell = rows[i].children[toggleColumn];  // ALL views will now be hidden, so all toggle buttons should say "+".
      const toggleButton = toggleCell.firstElementChild;
      toggleButton.setAttribute("value", "+");

      if (rows[i].classList.contains("loggedIn")) { // If this row used to represent the logged-in user...
        rows[i].classList.remove("loggedIn")        // remove formatting...
        const nameCell = rows[i].children[1];
        nameCell.removeAttribute("idr");                // remove idr, ondragover and ondrop.
        nameCell.removeAttribute("ondrop");
        nameCell.removeAttribute("ondragover");
      } // end if (row matches logged-in user)
      if (rows[i].classList.contains("activeView")) { // If this row was the active view (and formatted appropriately)...
        rows[i].classList.remove("activeView")        // remove formatting.
      }
    } // end for (all rows)
  } // end onLogout
}
