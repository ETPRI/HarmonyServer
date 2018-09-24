// add/edit relations for a node

// containerDOM: The DOM element that this widget will be inside.
// nodeID: The ID of the node being shown
// viewID: The ID of the person whose view is being shown
// relationType: Whether the relations shown are start, end or peer (not implemented)
// object and objectMethod: Kludges enabling this class to call methods from another class once it's finished its queries.
// objectMethod is the method and object is the object that contains it. I may remove these.
class widgetRelations {
constructor(containerDOM, nodeID, viewID, relationType, object, objectMethod) {
  // data to be displayed
  this.containerDOM = containerDOM;
  this.dragDrop     = null;
  this.nodeID       = nodeID;
  this.nodeGUID     = null;
  this.viewID       = viewID;
  this.viewNodeID   = null; // ID of the view node in the DB
  this.id           = app.idCounter; // ID of the widget being built
  this.relationType = relationType;
  this.existingRelations = {};      // contains objects that are already in the table (from a previous save).
                                    // Each key is the ID of a relation, each value is an object describing the node the relation goes to.
  this.object = object;
  this.objectMethod = objectMethod;

  this.idrContent   = 0;            // Number of existing editable cells added to table
  this.idrRow       = 0;            // Number of existing rows added to the table
  this.order = [];                  // Order of relations set by the current user
  this.placeholders = [];

  // Add to app.widgets
  app.widgets[app.idCounter++] = this;
  this.containedWidgets = [];

  this.refresh()
}

// Refreshes the widget by running the query to get all nodes in this user's view, then calling this.findLinks().
refresh() {
  if (this.viewID == "summary") {
    // search for all directLinks from this node to another with the appropriate direction
    const obj = {};
    obj.from = {"id":this.nodeID, "return":false};
    obj.rel = {"name":"r", "type":"directLink", "properties":{"direction":this.relationType}};
    obj.to = {"name":"a"};
    obj.order = [{"item":"rel", "name":"count", "direction":"D"}];

    const xhttp = new XMLHttpRequest();
    const relationObj = this;

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const data = JSON.parse(this.responseText);
        relationObj.rComplete(data);
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
    xhttp.send(JSON.stringify(queryObject));         // send request to server

  }

  else if (this.viewNodeID == null) {
    const obj = {};
    obj.start = {"id":this.viewID, "return":false};
    obj.rel1 = {"type":"Owner", "return":false};
    obj.middle = {"name":"view", "type":"M_View", "properties":{"direction":this.relationType}};
    obj.rel2 = {"type":"Subject", "return":false};
    obj.end = {"id":this.nodeID};

    const xhttp = new XMLHttpRequest();
    const relation = this;

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const data = JSON.parse(this.responseText);
        relation.findLinks(data);
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "CRUD", "function": "changeTwoRelPattern", "query": obj, "GUID": app.login.userGUID};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
  }

  else {
    this.findLinks();
  }
}

findLinks(data) { // data should include the view found by the previous function. Find all nodes that it is linked to.
  if (data && data[0].end) {
    this.nodeGUID = data[0].end.properties.M_GUID;
  }

  if (data && this.viewNodeID == null) {
    this.viewNodeID = data[0].view.id;
  }
  const obj = {};
  obj.required = {"name":"view", "id":this.viewNodeID};
  obj.optional = {"name":"a"};
  obj.rel = {"name":"r", "type":"Link"};

  const xhttp = new XMLHttpRequest();
  const relation = this;

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      relation.rComplete(data);
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server
}

// Takes the list of nodes in this user's view and begins building the widget by adding a "Save" or "Sync" button,
// calling this.complete() to build a table of existing data, then calling this.createDragDrop()
// to make the table editable if it belongs to the logged-in user.
rComplete(data) {
  this.containerDOM.setAttribute("id", this.id.toString()); // Make containerDOM a widget and give it an id
  this.containerDOM.setAttribute("class", "widget");

  // Create a save button if you're looking at your own view, or a sync button if you're looking at someone else's
  let buttonValue = "Sync";
  if (app.login.userID && app.login.userID == this.viewID) {
    buttonValue = "Save";
  }

  // Create table for existing data. NOTE: There's a call to this.complete() in here! It's easy to miss.
  this.containerDOM.innerHTML = `<input idr = "SaveSync" type="Button" value=${buttonValue} onclick="app.widget('saveSync', this)">
                                 <table>${this.complete(data)}</table>`;

  // Add a dragdrop table if this view belongs to the user who is logged in
  if (app.login.userID && app.login.userID == this.viewID) {
    // I kept getting errors without this. I think it was trying to run before the table finished rendering.
    // It has to have "this" passed in because a function called using setTimeout()
    // apparently doesn't consider its parent object to be "this".
    setTimeout(this.createDragDrop, 1, this);
  }
}

// Builds HTML for a table. Each row is a single relation and shows the number,
// the id, the other end and the type of that relation. Calls this.addLine() to add individual lines.
// "nodes" is the data returned from the database. Each line shows the view (which is the same for every line),
// a (the node), and r (the relation to that node).
complete(nodes) {
  let cells = ["Name", "Type", "Comment"];
  if (this.viewID == "summary") {
    cells = ["Count", "Name", "Type"];
  }
  const logNodes = JSON.parse(JSON.stringify(nodes)); // Need a copy that WON'T have stuff deleted, in order to log it later
  app.stripIDs(logNodes); // May as well go ahead and remove the IDs now
  let ordering = []; // Stores the ordered IDs, as stored in the table
  let placeholders = [];
  const orderedNodes = []; // Stores ordered DATA, which is reproducible and human-readable, for testing
  if (nodes[0] && nodes[0].view && nodes[0].view.properties && nodes[0].view.properties.order) { // If at least one node and an ordering were returned...
    ordering = nodes[0].view.properties.order;
  }
  if (nodes[0] && nodes[0].view && nodes[0].view.properties && nodes[0].view.properties.placeholders) { // if at least one node was returned and it has placeholders
    placeholders = nodes[0].view.properties.placeholders;
  }

  // Start building HTML for the table. Note the ondrop event in the template, which causes all rows to have the same ondrop event.
  let html       = `<thead><tr idr='template' ondrop="app.widget('dropData', this, event)">
                    <th>#</th> <th hidden>R#</th> <th hidden>N#</th> <th>${cells[0]}</th> <th>${cells[1]}</th> <th editable>${cells[2]}</th>
                    </tr></thead><tbody idr='container'>`;
  this.idrRow     = 0;
  this.idrContent = 0;
  this.existingRelations = {};

  // Iterate through "ordering", which is the array of node IDs the user stored in the order he/she stored them in.
  // NOTE: Uses Neo4j IDs. Should look into a better way of storing this information. Maybe I could include an "order number"
  // in the link to the node.
  for (let i = 0; i < ordering.length; i++) {
    // Check whether this should be a placeholder
    if (ordering[i].charAt(0) === "p") {
      const index = parseInt(ordering[i].slice(1));
      const comment = placeholders[index];
      html = this.addLine(null, html, orderedNodes, comment);
      // remove from array
      delete placeholders[index];
    }
    else {
    // Find the item in nodes which matches, if any
      const relation = nodes.filter(node => node.r && node.r.properties && node.r.properties.M_GUID == ordering[i]);
      if (relation[0]) { // If that relation still exists, add it to the table and delete it from the list of relations
        html = this.addLine(relation[0], html, orderedNodes);
        // Remove from array
        const index = nodes.indexOf(relation[0]);
        delete nodes[index];
      } // end if (relationship found)
    } // end else (not placeholder)
  } // end for (each item in ordering)

  // logging
  const obj = {};
  obj.nodes = logNodes;
  obj.order = orderedNodes;
  app.regression.log(JSON.stringify(obj));
  app.regression.record(obj);

  if (this.object && this.objectMethod) {
    this.object[this.objectMethod]();
    this.object = null;
    this.objectMethod = null;
  }

  // add unordered data, if any. NOTE: Think about whether this is still needed.
  // If a user stores relations, don't they also automatically store an ordering which includes all those relations?
  for (let i = 0; i < nodes.length; i++) {
    // Some entries will be undefined because they were added as ordered data and deleted. Skip them.
    // Also, it's possible that only the view was found, not a node - skip this.
    if (nodes[i] !== undefined && nodes[i].a) {
      html = this.addLine(nodes[i], html);
    }
  }

  for (let i = 0; i < placeholders.length; i++) {
    if (placeholders[i] !== undefined) { // Some entries will be undefined because they were added as ordered data and deleted. Skip them.
      html = this.addLine(null, html, null, placeholders[i]);
    }
  }

  // At this point, "html" should contain almost all the HTML needed to render a table of all stored relations.
  // It just needs the closing </tbody> tag (<table> and </table> are in the rComplete line that called this function).
  return html + "</tbody>";
}

// Takes a row from the DB (including a relation and the object it links to), the HTML which is in progress from this.complete(),
// and the orderedNodes array, which stores data about nodes in the order in which they were stored (and are added).
// Adds to the existing HTML to produce another row in a table of relations, then adds data on the current node to orderedNodes.
// Makes the row draggable, and allows dropping and editing if the table being built is of the logged-in user's view.
// NOTE: Section on placeholders needs work.
addLine(relation, html, orderedNodes, placeholderComment) {
  let cells = ["", "", ""]; // the values to be entered in the table - either name, type and comment, or count, name and type
  let nodeID = "";
  let GUID = "";

  if (relation != null) {
    const rel = relation.r; // The relation described in this row of the table
    const node = relation.a; // The node which that relation links to
    nodeID = node.properties.M_GUID; // The ID of said node...
    GUID = rel.properties.M_GUID; // the relation ID

    if (this.viewID == "summary") {
      cells[0] = rel.properties.count;
      cells[1] = node.properties.name;
      cells[2] = node.labels[0];
    }
    else {
      cells[0] = node.properties.name;
      cells[1] = node.labels[0];
      if ("comment" in rel.properties) { // It's now possible to have a blank comment, so allow for that
        cells[2] = rel.properties.comment;
      }
    }
  } // end if (relation exists)

  else if (placeholderComment) { // placeholder relation
    cells[2] = placeholderComment;
  }

  // Default is that this is NOT the logged-in user's view. The row can only be dragged,
  // the cells can't be interacted with at all and the delete button is not needed.
  let trHTML = `<tr idr="item${this.idrRow}" draggable="true" ondragstart="app.widget('drag', this, event)">`;
  let deleteHTML = "";
  let editHTML = "";

  // If this is the logged-in user's view, they get the full functionality - ability to drag, drop and delete.
  if (app.login.userID && app.login.userID == this.viewID) {
    trHTML = `<tr idr="item${this.idrRow}" ondrop="app.widget('dropData', this, event)"
              ondragover="app.widget('allowDrop', this, event)" draggable="true"
              ondragstart="app.widget('drag', this, event)">`
    deleteHTML = `<td><button idr="delete${this.idrRow}" onclick="app.widget('markForDeletion', this)">Delete</button></td>`;
    editHTML = `ondblclick="app.widget('edit', this, event)"`;

    // Add this node's data to the list of relations that already exist.
    this.existingRelations[this.idrRow] = {'comment':cells[2], 'nodeID':nodeID, 'name':cells[0], 'type':cells[1]};

  }

  html += trHTML + `<td>${++this.idrRow}</td> <td hidden>${GUID}</td>
                    <td hidden idr="content${this.idrContent++}">${nodeID}</td>
                    <td idr="content${this.idrContent++}">${cells[0]}</td>
                    <td>${cells[1]}</td>
                    <td idr="content${this.idrContent++}" ${editHTML}>${cells[2]}</td>
                    ${deleteHTML}</tr>`;


  // If an array of ordered nodes was passed in, add this line to it
  if (orderedNodes) {
    const node = {};
    node.name = cells[0];
    node.type = cells[1];
    node.comment = cells[2];
    orderedNodes.push(node);
  }
  return html;
}

// Creates a dragDrop table if the logged-in user is looking at their own view. Adds three new functions to the table:
  // changeComment fires when a comment textbox is blurred, and adds or removes the "changedData" class depending on whether
    // the comment now matches the comment stored in the database.
  // dropData fires when a node from another view or a node table is dragged to the table. It either creates a new row
    //for that node, or changes the node referenced in the row that was dragged to.
  // drag overrides the drag function from the dragDrop class. It does the same thing - set the active node -
    // but it also records data about the line being dragged (in case that row is dragged to another table).
// Takes the widgetRelation object as an argument because it's called by setTimeout and can't refer to it as "this".
createDragDrop(widgetRel) {
  widgetRel.containedWidgets.push(app.idCounter); // The dragDrop table will be a widget, so add it to the list of "widgets the widgetRelation contains"
  // Create the new dragDrop table
	widgetRel.dragDrop = new dragDropTable("template", "container", widgetRel.containerDOM, widgetRel.idrRow, widgetRel.idrContent);
  // Make the edit textbox call the new "changeComment" method instead of dragDrop's "save" method
  widgetRel.dragDrop.editDOM.setAttribute("onblur", " app.widget('changeComment', this); app.widget('save', this)");
  // Make a copy of this.existingRelations and attaches it to the dragDrop table
  widgetRel.dragDrop.existingRelations = JSON.parse(JSON.stringify(widgetRel.existingRelations));

  // create the new changeComment function, which just updates the class of a row when its comment is edited
  widgetRel.dragDrop.changeComment = function(input) { // input should be the edit object, which is still attached to the row being edited
    const commentCell = input.parentElement; // Get the cell that was just edited
    const row = commentCell.parentElement;
    const idr = row.getAttribute('idr').slice(4); // the idr is like "itemxxx"
    // const IDcell = row.children[1];
    // const ID = IDcell.textContent; // Get the node ID of the row that was changed

    if (idr in this.existingRelations) { // If that node is an existing relation (that is, it's been saved)...
      if (input.value != this.existingRelations[idr].comment) { // and the new value is DIFFERENT from the saved value...
        commentCell.classList.add("changedData"); // mark it as "changed data".
      }
      else { // If the node exists, and the new value is THE SAME AS the saved value...
        commentCell.classList.remove("changedData"); // make sure it's NOT marked "changed data".
      }
    }
  } // end dragdrop.changeComment function

  // create the new dropData function. When something is dropped on a row in the table, dropData checks the source.
  // If it's a row from the same table, it calls drop instead to rearrange rows. If it's row from another relations table,
  // it copies the row. If it's a cell from a widgetTableNodes and it was dragged to the input row, it makes a new row.
  // If the source is a cell from a widgetTableNodes, and the row it was dragged to isn't the input row,
  // it updates that row to refer to the node that was dragged.
  widgetRel.dragDrop.dropData = function(input, evnt) {
    // Get the idr of the row that was dragged to
    let row = input;
    let idr = row.getAttribute("idr");
    let idrInt = idr.slice(4); // remove the "item" at the start

    // Get the data from the element that was being dragged
    const dataText = evnt.dataTransfer.getData("text/plain");
    const data = JSON.parse(dataText);

    // If the source is a cell from this dragDrop table, we are rearranging. Call drop instead.
    if (data.sourceType == "dragDrop" && data.sourceTag == "TR" && data.sourceID == this.id) {
            this.drop(input, evnt);
    }

    // If the source is a cell from a widgetTableNodes, we are either adding a new entry or changing an entry's node.
    // If the source is another table of relations, we are definitely adding a new entry.
    else if (data.sourceType == "widgetTableNodes" && data.sourceTag == "TD" ||
             data.sourceType == "widgetRelations" && data.sourceTag == "TR" ||
             data.sourceType == "widgetNode" && data.sourceTag == "B" ||
             data.sourceType == "dragDrop" && data.sourceTag == "TR" && data.sourceID != this.id) {

      if (idr != "template") { // Verify that the destination is not in the template row...

        // If a node was dragged from a node table to the insert row, or a whole relation was dragged from another table to ANY row, create a new row and add to that.
        if (idr == "insertContainer" || data.sourceType == "widgetRelations" || data.sourceType == "dragDrop") {
          row = this.insert(null, row);
          idr = row.getAttribute("idr");
        }

        // get the cells in the target row where the name, type, node ID and comment are stored,
        // and update them to use the info from the element that was dragged
        const nodeIDcell = row.children[2];
        nodeIDcell.textContent = data.nodeID;
        const nameCell = row.children[3];
        nameCell.textContent = data.name;
        const typeCell = row.children[4];
        typeCell.textContent = data.type;
        if ('comment' in data) {
          const commentCell = row.children[5];
          commentCell.textContent = data.comment;
        }

        // If this relation was already in the database, check whether any data that was added differs from what's recorded.
        // Mark the cells as changed or not accordingly.
        if (idrInt in this.existingRelations) {
          if (nodeIDcell.textContent != this.existingRelations[idrInt].nodeID) { // Check the node ID...
            nodeIDcell.classList.add("changedData");
          } else {
            nodeIDcell.classList.remove("changedData");
          }

          if (nameCell.textContent != this.existingRelations[idrInt].name) { // and the name...
            nameCell.classList.add("changedData");
          } else {
            nameCell.classList.remove("changedData");
          }

          if (typeCell.textContent != this.existingRelations[idrInt].type) { // and the type.
            typeCell.classList.add("changedData");
          } else {
            typeCell.classList.remove("changedData");
          }
          // No need to check the comment - comments only come in with rows from other views,
          // and that will always make a new row, not change an existing one.
        } // end if (relation ID appears in existing relations)

        // Make this the active widget
        if (app.activeWidget) {
          app.activeWidget.classList.remove("activeWidget");
        }
        app.activeWidget = this.domElement;
        this.domElement.classList.add("activeWidget");

        //log
        const obj = {};
        obj.id = app.domFunctions.widgetGetId(input);
        obj.idr = input.getAttribute("idr");
        obj.action = "drop";
        app.regression.log(JSON.stringify(obj));
        app.regression.record(obj);
      } // end if (cell is not in template row)
    } // end else if (the source was a widgetTableNodes cell)
  } // end dragDrop.dropData function

  // Create the new drag function, which sets the active node and stores data about the row being dragged.
  widgetRel.dragDrop.drag = function(input, evnt){ // Expand drag function to store data as well as mark an active node
    this.activeNode = evnt.target;

    // Extract the needed data from the row being dragged
    const IDcell = this.activeNode.children[2];
    const ID = IDcell.textContent;
    const nameCell = this.activeNode.children[3];
    const name = nameCell.textContent;
    const typeCell = this.activeNode.children[4];
    const type = typeCell.textContent;
    const commentCell = this.activeNode.children[5];
    const comment = commentCell.textContent;

    // Create an object which stores all the data
    const data = {};
    data.nodeID = ID;
    data.name = name;
    data.type = type;
    data.comment = comment;
    data.sourceID = app.domFunctions.widgetGetId(input);
    data.sourceType = "dragDrop";
    data.sourceTag = input.tagName;

    // Stringify it and store it in dataTransfer
    evnt.dataTransfer.setData("text/plain", JSON.stringify(data));

    // Log
    const obj = {};
    obj.id = this.domFunctions.widgetGetId(evnt.target);
    obj.idr = event.target.getAttribute("idr");
    obj.action = "dragstart";
    this.log(JSON.stringify(obj));
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  } // end dragDrop.drag function
}

// If the logged-in user is looking at their own view, calls this.processNext(), which will save all rows, save their ordering,
// and then call this.refresh() in order to clear formatting (new data, changed data, etc.) and remove deleted rows.
// If the user isn't logged in or is looking at someone else's view, just calls this.refresh() to get up-to-date info.
saveSync(button) {
  // Log first to make sure the click is logged BEFORE any data
  const obj = {};
  obj.id = app.domFunctions.widgetGetId(button);
  obj.idr = button.getAttribute("idr");
  obj.action = "click";
  app.regression.log(JSON.stringify(obj));
  app.regression.record(obj);

  // If this is the user's view, save all changed data, then refresh. If it's anyone else's, just refresh.
  if (app.login.userID && app.login.userID == this.viewID) {

    // If there is any unsaved text in the dragDrop table's insert row...
    if (Array.from(this.dragDrop.insertContainer.getElementsByTagName("INPUT")).filter(x => x.value != "").length > 0) {
      this.dragDrop.insert(); // add a row for it before saving
    }

    const widgetID = app.domFunctions.widgetGetId(button);
    const relWidget = document.getElementById(widgetID); // Returns the relations widget
    const tableWidget = relWidget.getElementsByClassName("widget")[0]; // The only subwidget inside the relations widget should be the table
    const container = app.domFunctions.getChildByIdr(tableWidget, "container");
    const rows = Array.from(container.children); // Get an array of all rows in the table

    // Call this.processNext() to deal with the first row. Each time processNext runs, it either calls itself on the next row,
    // or calls a function which eventually calls processNext() on the next row, so that eventually all rows are processed.
    this.processNext(null, rows);
  } // end if (user is logged in and looking at their own view)
  else {
    this.refresh();
  }
}

// Examines a row to see what, if anything, needs to be done with it - delete it from the DB, add it to the DB,
// replace it in the DB (needed for changing the node - relations can't change their endpoints), edit it or nothing.
// Then calls the appropriate function - deleteNode(), addNode(), replaceNode(), modifyNode(), or processNext()
// to skip a row that doesn't need to change the DB. (All other functions this can call eventually call processNext() again).
processNext(data, rows, prevFunction) {
  // The only processing function that returns data is addNode, which returns a relation.
  // If processNext gets data, it is the relation from an addNode call. Extract the GUID and add it to the order array.
  if (prevFunction == "add") {
    const id = data[0].link.properties.M_GUID;
    this.order.push(id);
  }

  if (rows.length >0) { // If there are more rows to process...
    const row = rows.pop();
    if (row.classList.contains("deletedData")) { // If the relation has been marked for deletion, delete it. No need to add to order array.
      this.deleteNode(row, rows);
    }
    // if this is a placeholder relation, add it to the placeholders array. Doesn't matter whether it's changed or not,
    // as long as it's not deleted. Add to order array as well.
    else if (row.children[2].textContent === "" && row.getAttribute('idr') !== 'insertContainer') {
      this.placeholders.push(row.children[5].textContent); // add comment to array
      this.order.push(`p${this.placeholders.length-1}`); // add index to order array, prefaced by "p" for "placeholder"
      this.processNext(null, rows);
    }
    else if (row.classList.contains("newData")) { // If the relation is new, add it. Can't add to order array yet - that will be done once a relation ID is assigned.
      this.addNode(row, rows);
    }
    else if (row.children[2].classList.contains("changedData")) { // If the node ID has been changed, replace the relation. ID will be added to array after the new relation ID is assigned.
      this.replaceNode(row, rows);
    }
    else if (row.children[5].classList.contains("changedData")) { // If the comment has been changed, modify the relation. Go ahead and add ID now - it won't change.
      const cells = row.children;
      const idCell = cells[1];
      const id = idCell.textContent;
      this.order.push(id);
      this.modifyNode(row, rows);
    }
    else { // If the row doesn't need any processing, just add its ID to order and move on
      const cells = row.children;
      const idCell = cells[1];
      const id = idCell.textContent;
      if (id) { // Don't push ID if it doesn't exist (that will happen when the insert row is processed)
        this.order.push(id);
      }
      this.processNext(null, rows);
    }
  }
  else { // when all rows are processed
    this.order.reverse();

    // Update view ordering and refresh
    const obj = {};
    obj.node = {"name":"view", "id":this.viewNodeID};
    obj.changes = [{"property":"order", "value":JSON.stringify(this.order), "string":false},
                   {"property":"placeholders", "value":JSON.stringify(this.placeholders), "string":false}];

    const xhttp = new XMLHttpRequest();
  	const relations = this;

  	xhttp.onreadystatechange = function() {
  		if (this.readyState == 4 && this.status == 200) {
  			const data = JSON.parse(this.responseText);
  			relations.findLinks(data);
  		}
  	};

  	xhttp.open("POST","");
  	const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": app.login.userGUID};
  	xhttp.send(JSON.stringify(queryObject));         // send request to server

    this.placeholders = [];
    this.order = []; // Finally, reset this.order and this.placeholders.
  }
}

// Delete the relation represented by the given row from the DB.
// Then call processNext() on the array of remaining rows.
deleteNode(row, rows) {
  // Get the ID of the relation to delete
  const cells = row.children;
  const idCell = cells[1];
  const id = idCell.textContent;

  // delete the relation, then call processNext() to do the next row.
  const obj = {};
  obj.to = {"name":"node"};
  obj.rel = {"properties":{"M_GUID":id}, "return":false};

  const xhttp = new XMLHttpRequest();
  const relation = this;

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      relation.processNext(null, rows);
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "deleteRelation", "query": obj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server

  // meanwhile, check for a directLink relation with the other node (it SHOULD exist).
  // If its count is 1, delete it; otherwise, decrement the count.
  const nodeGUIDcell = cells[2];
  const otherNodeGUID = nodeGUIDcell.textContent;

  let from = this.nodeGUID;
  let to = otherNodeGUID;

  if (this.relationType === "end") {
    from = otherNodeGUID;
    to = this.nodeGUID;
  }
  const obj2 = {};
  obj2.from = {"properties":{"M_GUID":from}, "return":false};
  obj2.rel = {"type":"directLink", "properties":{"direction":this.relationType}};
  obj2.to = {"properties":{"M_GUID":to}, "return":false};

  const xhttp2 = new XMLHttpRequest();

  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      const xhttp3 = new XMLHttpRequest(); // new request
      obj2.rel.return = false; // no matter what, don't need to return anything
      if (data.length > 0) {
        if (parseInt(data[0].rel.properties.count) <= 1) { // if the count is 1 (or, somehow, less), delete the relation
          xhttp3.open("POST","");
          const queryObject3 = {"server": "CRUD", "function": "deleteRelation", "query": obj2, "GUID": app.login.userGUID};
          xhttp3.send(JSON.stringify(queryObject3));
        }
        else { // if the count is higher than 1, decrement its count
          obj2.changes = [{"item":"rel", "property":"count", "value":parseInt(data[0].rel.properties.count) - 1}]; // decrement count

          xhttp3.open("POST",""); // update link
          const queryObject3 = {"server": "CRUD", "function": "changeRelation", "query": obj2, "GUID": app.login.userGUID};
          xhttp3.send(JSON.stringify(queryObject3));
        }
      }
    }
  };

  xhttp2.open("POST","");
  const queryObject2 = {"server": "CRUD", "function": "changeRelation", "query": obj2, "GUID": app.login.userGUID};
  xhttp2.send(JSON.stringify(queryObject2));         // send request to server
}

// A workaround for the fact that Neo4j doesn't let you change the nodes a relationship is attached to.
// Instead, this function starts the process of replacing the node by deleting its relation from the database,
// changing its class in the table to "newData", and pushing it back onto the array of rows.
// Because pop() returns the item that was pushed most recently, this row will be processed a second time
// before anything else is, preserving the ordering. The second time it will be handled by addNode, and
// the relation will be added with its new endpoint.
replaceNode (row, rows) {
  row.classList.remove("changedData");
  row.classList.add("newData");
  rows.push(row);
  this.deleteNode(row, rows);
}

// Simply updates a relation in the DB to include a new comment, then calls processNext() again.
modifyNode (row, rows) {
  // Get the ID of the relation to update and the new comment to include
  const cells = row.children;
  const idCell = cells[1];
  const GUID = idCell.textContent;
  const commentCell = cells[5];
  const comment = commentCell.textContent;

  const obj = {};
  obj.rel = {"properties":{"M_GUID":GUID}, "return":false};
  obj.changes = [{"item":"rel", "property":"comment", "value":app.stringEscape(comment)}];

  const xhttp = new XMLHttpRequest();
  const relation = this;

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      relation.processNext(data, rows, "modify");
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server
}

// Adds a new relation to the node being viewed. If a destination node was specified for the relation,
// adds a relation between the user's view of the node and the destination node, then adds a relation
// between the user's view of the destination node and this one (so that no matter which node you look
// at, you see the relation). If no other node was specified, a placeholder relation is added to the
// original node. NOTE: The section on placeholders needs work.
addNode(row, rows) {
  // Start the query by searching for this user's view of this node.
  const obj = {};
  obj.start = {"properties":{"M_GUID":app.login.userGUID}, "return":false};
  obj.rel1 = {"type":"Owner", "return":false};
  obj.middle = {"type":"M_View", "properties":{"direction":this.relationType}};
  obj.rel2 = {"type":"Subject", "return":false};
  obj.end = {"properties":{"M_GUID":this.nodeGUID}, "return":false};

  const xhttp = new XMLHttpRequest();
  const relationObj = this;

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      if (data.length > 0) {
        relationObj.createLink(data[0].middle.id, row, rows);
      }
      else {
        relationObj.createView(row, rows);
      }
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "changeTwoRelPattern", "query": obj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server

  // Meanwhile, search for a direct link between the other node and this one.
  // (If it's found, we'll increment the count. If not, we'll create it.)
  const cells = row.children;
  const nodeGUIDcell = cells[2];
  const otherNodeGUID = nodeGUIDcell.textContent;

  let from = this.nodeGUID;
  let to = otherNodeGUID;

  if (this.relationType === "end") {
    from = otherNodeGUID;
    to = this.nodeGUID;
  }
  const obj2 = {};
  obj2.from = {"properties":{"M_GUID":from}, "return":false};
  obj2.rel = {"type":"directLink", "properties":{"direction":this.relationType}};
  obj2.to = {"properties":{"M_GUID":to}, "return":false};

  const xhttp2 = new XMLHttpRequest();

  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      const xhttp3 = new XMLHttpRequest(); // new request
      obj2.rel.return = false; // no matter what, don't need to return anything

      if (data.length == 0) { // If there isn't an existing direct relation, create one with a count of 1
        obj2.rel.properties.count = 1; // add count to the object used to search for the link...

        xhttp3.open("POST",""); // create link
        const queryObject3 = {"server": "CRUD", "function": "createRelation", "query": obj2, "GUID": app.login.userGUID};
        xhttp3.send(JSON.stringify(queryObject3));
      }
      else { // if there is an existing direct relation, increment its count
        obj2.changes = [{"item":"rel", "property":"count", "value":parseInt(data[0].rel.properties.count) + 1}]; // increment count

        xhttp3.open("POST",""); // update link
        const queryObject3 = {"server": "CRUD", "function": "changeRelation", "query": obj2, "GUID": app.login.userGUID};
        xhttp3.send(JSON.stringify(queryObject3));
      }
    }
  };

  xhttp2.open("POST","");
  const queryObject2 = {"server": "CRUD", "function": "changeRelation", "query": obj2, "GUID": app.login.userGUID};
  xhttp2.send(JSON.stringify(queryObject2));         // send request to server
}

// Create the link to the other node (at this point, the view exists and is linked to the owner and subject)
createLink(ID, row, rows) {
  let attributes = {};
  let otherNodeGUID;

  // Get the list of attributes of the relation (currently, just a comment, but could change)
  const widgetID = app.domFunctions.widgetGetId(row);
  const widget = document.getElementById(widgetID);
  const headerRow = app.domFunctions.getChildByIdr(widget, "template");
  const headers = headerRow.children;

  const cells = row.children;
  const relIDcell = cells[1];
  const relID = relIDcell.textContent;
  const nodeGUIDcell = cells[2];

  // Get the ID of the other node, if one was specified. Now that placeholders are not stored as links, this should ALWAYS HAPPEN.
  if (nodeGUIDcell.textContent != "") {
    otherNodeGUID = nodeGUIDcell.textContent;

    // Build a string of attributes for the relation. Each attribute takes the form name:value.
    // Start at i = 5 because the first 5 columns describe the node or are auto-generated - they aren't attributes of the relation.
    // Stop at headers.length-1 because the last cell just holds the delete button.
    for (let i = 5; i < headers.length-1; i++) {
      const text = cells[i].textContent;
      if (text != "") {
        attributes[headers[i].textContent.toLowerCase()] = app.stringEscape(text);
      }
    }

    const obj = {};
    obj.from = {"id":ID};
    obj.rel = {"type":"Link", "properties":attributes, "name":"link"};
    obj.to = {"properties":{"M_GUID":otherNodeGUID}};

    const xhttp = new XMLHttpRequest();
    const relationObj = this;

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const data = JSON.parse(this.responseText);
        relationObj.processNext(data, rows, "add");
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "CRUD", "function": "createRelation", "query": obj, "GUID": app.login.userGUID};
    xhttp.send(JSON.stringify(queryObject));         // send request to server

  } // end if (there is an ID for the other node)
  else { // this should never happen, but just in case, if there's no other node ID, just call processNext.
    this.processNext(null, rows);
  }
}

// Create the user's view of the node
createView(row, rows) {
  const obj = {"type":"M_View", "properties":{"direction":this.relationType}};

  const xhttp = new XMLHttpRequest();
  const relationObj = this;

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      relationObj.createOwner(data[0].node.id, row, rows);
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "createNode", "query": obj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server
}

// Create the Owner and Subject relations for a new View node, then call createLink to add the Link relation.
createOwner(ID, row, rows) {
  const ownerObj = {};
  ownerObj.from = {"properties":{"M_GUID":app.login.userGUID}};
  ownerObj.rel = {"type":"Owner"};
  ownerObj.to = {"id":ID};

  const xhttp = new XMLHttpRequest();
  const relationObj = this;

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      relationObj.createSubject(ID, row, rows);
    }
  };

  xhttp.open("POST","");
  const ownerQueryObject = {"server": "CRUD", "function": "createRelation", "query": ownerObj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(ownerQueryObject));         // send request to server
}

createSubject(ID, row, rows) {
  const subjectObj = {};
  subjectObj.from = {"id":ID};
  subjectObj.rel = {"type":"Subject"};
  subjectObj.to = {"properties":{"M_GUID":this.nodeGUID}};

  const xhttp = new XMLHttpRequest();
  const relationObj = this;

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      relationObj.createLink(ID, row, rows);
    }
  };

  xhttp.open("POST","");
  const subjectQueryObject = {"server": "CRUD", "function": "createRelation", "query": subjectObj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(subjectQueryObject));         // send request to server
}

// Fires when a row from any relations table - whether it's the fully interactive table for a logged-in user,
// or the read-only table for someone else - is dragged. Stores data from that row in dataTransfer.
drag(line, evnt) {
  const data = {};
  data.name = line.children[3].textContent;
  data.type = line.children[4].textContent;
  data.nodeID = line.children[2].textContent;
  data.comment = line.children[5].textContent;
  data.sourceID = app.domFunctions.widgetGetId(line);
  data.sourceType = "widgetRelations";
  data.sourceTag = line.tagName;
  evnt.dataTransfer.setData("text/plain", JSON.stringify(data));

  const obj = {};
  obj.id = app.domFunctions.widgetGetId(line);
  obj.idr = line.getAttribute("idr");
  obj.action = "dragstart";
  app.regression.log(JSON.stringify(obj));
  app.regression.record(obj);
}
} ///////////////////// endclass
