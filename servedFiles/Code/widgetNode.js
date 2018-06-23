/*

add/edit one node in a form - view Relations

input: label
       data is optional.  Add mode is used if data is not supplied
       navigate a graph -


       input: node ID

       match (a) where id(p)=0
       match (b) where id(a)=12
       create (a)-[:worksAt2 {}]->(b)
*/


class widgetNode {
constructor(callerID, label, id, name) {
  // DOM pointers to data that will change, just make place holders
  this.widgetDOM   = {};
  this.relationsFrom = {}; // place holder for relations ->(n)
  this.relationsTo   = {}; // place holder for relations   (n)->
  this.addSaveDOM  = {};
  this.tableDOM    = {};
  this.fromDOM     = {}; // Is this ever used?
  this.toDOM       = {}; // Is this ever used?
  this.endDOM      = {}; // sub widget
  this.startDOM    = {}; // sub widget

  this.label       = label;
  this.queryObject = app.metaData.getNode(label);
  this.fields      = this.queryObject.fields;
  this.name        = name;

  this.idWidget = app.idCounter;
  app.widgets[app.idCounter] = this; // Add to app.widgets
  this.containedWidgets = [];
  this.callerID = callerID;

  this.db          = new db();

  // If we're editing, then the ID for the node was passed in.
  if (id) {
    // DBREPLACE DB function: changePattern
    // JSON object: {nodesFind: [{name: n; id: id}, {name: a; id: app.login.userID}]
    //               relsFind: [{name: r; from: a; to: n; type: Trash; optional: true}]}
    const obj = {};
    obj.required = {};
    obj.required.name = "n";
    obj.required.id = id;
    obj.optional = {};
    obj.optional.name = "a";
    obj.optional.id = app.login.userID;
    obj.rel = {};
    obj.rel.name = "r";
    obj.rel.type = "Trash";
    obj.rel.direction = "left"; // (n)<-[rel]-(a)
    app.nodeFunctions.findOptionalRelation(obj, this, 'finishConstructor');


    // this.db.setQuery(`match (n) where ID(n)=${id} match (a) where ID(a)=${app.login.userID}
    //                   optional match (a)-[r:Trash]->(n)
    //                   return n, r.reason as reason`);
    //
    // this.db.runQuery(this, 'finishConstructor');
  } else {
     this.finishConstructor();
   }
}

finishConstructor(data) {
  if (data) { // If data were passed in, add them to the table
    if (data[0].n.ID) {
      data[0].n.identity = data[0].n.ID;
    }
    this.dataNode = data[0].n;

    const obj = {};
    obj.data = JSON.parse(JSON.stringify(data));
    app.stripIDs(obj.data);
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  this.buildWidget();
  this.buildDataNode();

  if (data) { // I hate to do this twice, but I have to create dataNode before I can call buildWidget or buildDataNode, and I have to call buildWidget before changing and using DOM elements.
    if (data[0].reason) { // If a reason for trashing was returned (meaning that the node was already trashed by this user)...
      this.dataNode.properties.trash=true;
      this.dataNode.properties.reason = data[0].reason;                                                // Record in the dataNode that it was trashed already...
      const trashCheck = app.domFunctions.getChildByIdr(this.widgetDOM, "trashCheck");
      trashCheck.checked=true;

      const reason = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
      const reasonText = app.domFunctions.getChildByIdr(this.widgetDOM, 'reasonText');      // Show the reason prompt and textbox...
      reason.removeAttribute("hidden");
      reasonText.removeAttribute("hidden");
      reason.setAttribute("value", data[0].reason);                                    // And prefill that textbox with the reason.
    }

    this.buildStart();
  }
}

buildStart() {
  this.containedWidgets.push(app.idCounter);
  new widgetView(this.startDOM, this.dataNode.identity, "start", this, 'buildEnd');
}

buildEnd() {
  this.containedWidgets.push(app.idCounter);
  new widgetView(this.endDOM, this.dataNode.identity, "end");
}

buildWidget() { // public - build table header
  let id=null;  // assume add mode
  let name = this.name;
  if (name == "") {
    name = `New ${this.label} Node`;
  }

  if (this.dataNode) {
    // we are edit mode
    id = this.dataNode.identity;
    name = this.dataNode.properties.name;
  }

  const html = app.widgetHeader() + `<b idr="nodeLabel">${this.label}#${id}: ${name}</b></div><table><tbody><tr>
  <td idr="end"></td>
  <td>
    <input idr = "addSaveButton" type="button" onclick="app.widget('saveAdd',this)"></div>
    <table idr = "nodeTable"></table>
  </td>
  <td idr="start"></td>
  </tr></tbody></table></div>
  `
  /*
  Create new element, append to the widgets div in front of existing widgets
  */
  const parent = document.getElementById('widgets');
  const caller = document.getElementById(this.callerID);
  const newWidget = document.createElement('div'); // create placeholder div
  parent.insertBefore(newWidget, caller); // Insert the new div before the widget that opened it
  newWidget.outerHTML = html; // replace placeholder with the div that was just written

  // By this point, the new widget div has been created by buildHeader() and added to the page by the above line
  const widget = document.getElementById(this.idWidget);
  this.widgetDOM  = widget;

  if (app.activeWidget) {
    app.activeWidget.classList.remove("activeWidget");
  }
  app.activeWidget = this.widgetDOM;
  this.widgetDOM.classList.add("activeWidget");

  this.addSaveDOM = app.domFunctions.getChildByIdr(widget, "addSaveButton");
  this.tableDOM   = app.domFunctions.getChildByIdr(widget, "nodeTable");
  this.endDOM     = app.domFunctions.getChildByIdr(widget, "end");
  this.startDOM   = app.domFunctions.getChildByIdr(widget, "start");
}


buildDataNode() {   // put in one field label and input row for each field
  let fieldCount = 0;
  let value = "";

  // Clear any existing data
  while (this.tableDOM.hasChildNodes()) {
    this.tableDOM.removeChild(this.tableDOM.firstChild);
  }

  // NOTE: Kludge to be removed once all function calls return ID number instead of identity object
  if (this.dataNode && ("id" in this.dataNode)) {
    this.dataNode.identity = this.dataNode.id;
    delete this.dataNode.id;
  }

  for (let fieldName in this.fields) {

    // Create a table row
    const row = document.createElement('tr');
    this.tableDOM.appendChild(row);

    // Create the first cell, a th cell containing the label as text
    const header = document.createElement('th');
    row.appendChild(header);
    const labelText = document.createTextNode(this.fields[fieldName].label);
    header.appendChild(labelText);

    // Create the second cell, a td cell containing an input which has an idr, an onChange event, and a value which may be an empty string
    if (this.dataNode) {
      const d=this.dataNode.properties;
      value = d[fieldName];
      if (value) { // No need to sanitize data that don't exist, and this can avoid errors when a value is undefined during testing
        value = value.replace(/"/g, "&quot;");
      }
    }

    else if (fieldName == "name") {
      value = this.name;
    }


    const dataField = document.createElement('td');
    row.appendChild(dataField);
    const input = document.createElement('input');
    dataField.appendChild(input);
    input.outerHTML = `<input type = "text" db = ${fieldName} idr = "input${fieldCount++}" onChange = "app.widget('changed',this)" value = "${value}">`
    value="";
  }

  // Create div for the "trash" checkbox and reason
  const trashRow = document.createElement('tr');
  const trash = document.createElement('td');
  trashRow.appendChild(trash);
  const trashInput = document.createElement('td');
  trashRow.appendChild(trashInput);

  const trashTextSection = document.createElement('b');
  const trashText = document.createTextNode("Trash Node");
  trashTextSection.appendChild(trashText);
  trash.appendChild(trashTextSection);

  const checkbox = document.createElement('input');
  checkbox.setAttribute("type", "checkbox");
  checkbox.setAttribute("onclick", "app.widget('toggleReason', this)");
  checkbox.setAttribute("idr", "trashCheck");
  trash.appendChild(checkbox);

  const reasonTextSection = document.createElement('b');
  const reasonText = document.createTextNode("Reason: ");
  reasonTextSection.appendChild(reasonText);
  reasonTextSection.setAttribute("idr", "reasonText");
  reasonTextSection.setAttribute("hidden", true);
  trash.appendChild(reasonTextSection);

  const reason = document.createElement("input");
  reason.setAttribute("hidden", true);
  reason.setAttribute("onblur", "app.widget('changed', this)");
  reason.setAttribute("idr", "trashReason");
  reason.setAttribute("db", "reason");
  trashInput.appendChild(reason);

  if (!app.login.userID) { // If no user is logged in
    trashRow.setAttribute("hidden", "true");
  }
  this.tableDOM.appendChild(trashRow);
  app.login.viewLoggedIn.push(trashRow);

  // set the button to be save or added
  if (this.dataNode) {this.addSaveDOM.value = "Save";
  } else {this.addSaveDOM.value = "Add";}
}

saveAdd(widgetElement) { // Saves changes or adds a new node
  // director function
  if (widgetElement.value === "Save") {
    const checkbox = app.domFunctions.getChildByIdr(this.widgetDOM, "trashCheck");
    if (this.dataNode.properties.trash === true && checkbox.checked === false && app.login.userID) { // If the node was trashed and now shouldn't be
      this.untrashNode(widgetElement);
    }
    else if (!(this.dataNode.properties.trash === true) && checkbox.checked === true && app.login.userID) { // If the node was not trashed and now should be
      this.trashNode(widgetElement);
    }
    else if (this.dataNode.properties.trash === true && app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason').classList.contains("changedData") && app.login.userID) { // If the node was and should stay trashed, but the reason has changed
      this.updateReason(widgetElement);
    }
    else { // If the node's trash status isn't changing, only the data, go straight to save().
      this.save(widgetElement);
    }
  } else {
    this.add(widgetElement);
  }
}

trashNode(widgetElement) {
  this.dataNode.properties.trash = true;
  const user = app.login.userID;
  const node = this.dataNode.identity;
  const reasonInp = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
  const reason = reasonInp.value;
  reasonInp.setAttribute("class",""); // remove changedData class from reason

  // DBREPLACE DB function: createRelation
  // JSON object: {from: {ID:user}; to: {ID:node}; type:"Trash"; properties:{reason:app.stringEscape(reason)}; merge:true}

  const obj = {};
  obj.from = {};
  obj.from.name = "user";
  obj.from.id = user;
  obj.to = {};
  obj.to.name = "node";
  obj.to.id = node;
  obj.rel = {};
  obj.rel.type = "Trash";
  obj.rel.merge = true;
  obj.rel.properties = {};
  obj.rel.properties.reason = app.stringEscape(reason);
  app.nodeFunctions.createRelation(obj, this, 'trashUntrash', widgetElement);

  const query = `match (user), (node) where ID(user)=${user} and ID(node)=${node} merge (user)-[tRel:Trash {reason:"${app.stringEscape(reason)}"}]->(node)`
  this.db.setQuery(query);
  this.db.runQuery(this, "trashUntrash", widgetElement);
}

updateReason(widgetElement) {
  const user = app.login.userID;
  const node = this.dataNode.identity;
  const reasonInp = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
  const reason = reasonInp.value;
  this.dataNode.properties.reason = reason;
  reasonInp.setAttribute("class","");

  // DBREPLACE DB function: changeRelation
  // JSON object: {from: {ID:user}; to: {ID:node}; type:"Trash"; changes:{reason:app.stringEscape(reason)}}
  const obj = {};
  obj.from = {};
  obj.from.name = "user";
  obj.from.id = user;
  obj.to = {};
  obj.to.name = "node";
  obj.to.id = node;
  obj.rel = {};
  obj.rel.name = "rel";
  obj.rel.type = "Trash";
  obj.changes = [];
  const change = {};
  change.item = "rel";
  change.property = "reason";
  change.value = app.stringEscape(reason);
  obj.changes.push(change);
  app.nodeFunctions.changeRelation(obj, this, 'trashUntrash', widgetElement);

  // const query = `match (user)-[rel:Trash]->(node) where ID(user) = ${user} and ID(node) = ${node} set rel.reason = "${reason}"`;
  // this.db.setQuery(query);
  // this.db.runQuery(this, "trashUntrash", widgetElement);
}

untrashNode(widgetElement) {
  this.dataNode.properties.trash = false;
  const user = app.login.userID;
  const node = this.dataNode.identity;

  // DBREPLACE DB function: deleteRelation
  // JSON object: {fromID: user; toID: node; type:Trash}
  const obj = {};
  obj.from = {};
  obj.from.name = "user";
  obj.from.id = user;
  obj.to = {};
  obj.to.name = "node";
  obj.to.id = node;
  obj.rel = {};
  obj.rel.name = "rel";
  obj.rel.type = "Trash";
  app.nodeFunctions.deleteRelation(obj, this, 'trashUntrash', widgetElement);

  // const query = `match (user)-[rel:Trash]->(node) where ID(user)=${user} and ID(node)=${node} delete rel`;
  // this.db.setQuery(query);
  // this.db.runQuery(this, "trashUntrash", widgetElement);
}

trashUntrash(data, widgetElement) {
  this.save(widgetElement, data);
}

////////////////////////////////////////////////////////////////////
add(widgetElement) { // Builds a query to add a new node, then runs it and passes the result to addComplete
  // CREATE (n:person {name:'David Bolt', lives:'Knoxville'}) return n

  let tr = this.tableDOM.firstElementChild;

  const create = "create (n:"+ this.label+" {#data#}) return n";
  let data={};
  while (tr) {
    const inp = tr.lastElementChild.firstElementChild;

    if (inp && inp.hasAttribute("db")) { // Only process input rows with a db value - not the trash div; that's done separately
      data[inp.getAttribute("db")] = app.stringEscape(inp.value);
      // data += inp.getAttribute("db") +':"' + app.stringEscape(inp.value) +'", ';
    }
    tr=tr.nextElementSibling;
  }

  const obj = {};
  obj.name = "n";
  obj.type = this.label;
  obj.properties = data;
  app.nodeFunctions.createNode(obj, this, 'addComplete');

  // const query = create.replace("#data#", data.substr(0,data.length-2) );
  // // DBREPLACE DB function: createNode
  // // JSON object (from example): {type:person; properties:{name: "David Bolt"; lives: "Knoxville"}}
  // this.db.setQuery(query);
  // this.db.runQuery(this,"addComplete");
}


addComplete(data) { // Refreshes the node table and logs that addSave was clicked
  this.dataNode = data[0].n; // takes single nodes
  const id = this.dataNode.ID;
  this.dataNode.identity = this.dataNode.ID; // NOTE: Kludge; remove later
  const name = this.dataNode.properties.name;
  const nodeLabel = app.domFunctions.getChildByIdr(this.widgetDOM, "nodeLabel");
  nodeLabel.textContent=`${this.label}#${id}: ${name}`;

  const obj = {};
  obj.id = this.idWidget;
  obj.idr = "addSaveButton";
  obj.action = "click";
  obj.data = JSON.parse(JSON.stringify(data));
  app.stripIDs(obj.data);
  app.regression.log(JSON.stringify(obj));
  app.regression.record(obj);

  this.buildDataNode();
  this.buildStart();
}


changed(input) { // Logs changes to fields, and highlights when they are different from saved fields
  if (!this.dataNode) {
    const obj = {};
    obj.id = app.domFunctions.widgetGetId(input);
    obj.idr = input.getAttribute("idr");
    obj.value = input.value;
    obj.action = "change";
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
    return;  // no feedback in add mode, but do log the change
  }
  // give visual feedback if edit data is different than db data
  if (input.value === this.dataNode.properties[input.getAttribute('db')]) {
    input.setAttribute("class","");
  } else {
    input.setAttribute("class","changedData");
  }

  // log
  const obj = {};
  obj.id = app.domFunctions.widgetGetId(input);
  obj.idr = input.getAttribute("idr");
  obj.value = input.value;
  obj.action = "change";
  app.regression.log(JSON.stringify(obj));
  app.regression.record(obj);
}


save(widgetElement, trashUntrash) { // Builds query to update a node, runs it and passes the results to saveData()
  /*
    MATCH (n)
    WHERE id(n)= 146
    SET n.born = 2003  // loop changed
    RETURN n
  */
  let tr = this.tableDOM.firstElementChild;

  let data={};
  while (tr) {
    const inp = tr.lastElementChild.firstElementChild;  // find <input> element
    if(inp.getAttribute("class") === "changedData") {
      // create a set for this field
      const fieldName = inp.getAttribute("db");
      // const d1 = "n."+ fieldName +"=#value#, ";
      // let d2 = "";
      if (fieldName in this.fields) {
        if (this.fields[fieldName].type === "number") {
          data[fieldName] = inp.value;  // number
        } else {
          data[fieldName] = app.stringEscape(inp.value);  // assume string
        }
      }
      // data += d1.replace('#value#',d2)
    }
    tr=tr.nextElementSibling;
  }

  if (data==={}) {
    if (trashUntrash) { // If the node was trashed or untrashed, but no other changes need to be made, don't bother to run an empty query or refresh the widget, but do log the fact that addSave was clicked.
      const obj = {};
      obj.id = this.idWidget;
      obj.idr = "addSaveButton";
      obj.action = "click";
      app.regression.log(JSON.stringify(obj));
      app.regression.record(obj);
    } else { // If the node was NOT trashed or untrashed AND there were no changes to fields, just alert that there were no changes. No need to log in this case.
    alert("no changes to save")
    }
  } else {
    // DBREPLACE DB function: changeNode
    // JSON object: {name: "n"; id:this.dataNode.identity; changes:{data.substr(0,data.length-2)}}, or I may change how data is built.

    const obj = {};
    obj.node = {};
    obj.node.name = "n";
    obj.node.id = this.dataNode.identity;
    obj.changes = data;

    app.nodeFunctions.changeNode(obj, this, 'saveData');

    // this.db.setQuery( `match (n) where id(n)=${this.dataNode.identity} set ${data.substr(0,data.length-2)} return n` );
    // this.db.runQuery(this,"saveData");
  }
}
saveData(data) { // Refreshes the node table and logs that addSave was clicked
  // redo from as edit now that data is saved
  // alert(JSON.stringify(data));
  this.dataNode = data[0].n;
  this.buildDataNode();

  // log
  const obj = {};
  obj.id = this.idWidget;
  obj.idr = "addSaveButton";
  obj.action = "click";
  obj.data = JSON.parse(JSON.stringify(data));
  app.stripIDs(obj.data);
  app.regression.log(JSON.stringify(obj));
  app.regression.record(obj);
}

toggleReason(checkBox) {
  const trashRow = checkBox.parentElement.parentElement;
  const reason = app.domFunctions.getChildByIdr(trashRow, 'trashReason');
  const reasonText = app.domFunctions.getChildByIdr(trashRow, 'reasonText');

  if (checkBox.checked) {
    reason.removeAttribute("hidden");
    reasonText.removeAttribute("hidden");
  }
  else {
    reason.setAttribute("hidden", true);
    reasonText.setAttribute("hidden", true);
  }
}
} ///////////////////// endclass
