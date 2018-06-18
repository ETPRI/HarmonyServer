class widgetDetails {
constructor(label, container, id) { // Label: the type of node described. ID: the ID of the node. Container: Where to put it
  // DOM pointers to data that will change, just make place holders
  this.widgetDOM   = container;
  this.tableDOM    = {};

  this.label       = label;
  this.queryObject = app.metaData.getNode(label);
  this.fields      = this.queryObject.fields;

  this.idWidget = app.idCounter;
  app.widgets[app.idCounter] = this; // Add to app.widgets

  this.db          = new db();

  // If we're editing, then the ID for the node was passed in.
  if (id) {
    if (app.login.userID) { // If the user is logged in - they should be, at this point.
      // DBREPLACE DB function: changePattern
      // JSON object: {nodesFind: [{name:"n"; ID:id}, {name:"a"; ID:app.login.userID}],
      //               relsFind: [{name:"r"; type:"Trash"; from:"a"; to:"n"}]}
      this.db.setQuery(`match (n) where ID(n)=${id} match (a) where ID(a)=${app.login.userID}
                        optional match (a)-[r:Trash]->(n)
                        return n, r.reason as reason`);
    }
    this.db.runQuery(this, 'finishConstructor');
  } else { // If no ID was passed in
     this.finishConstructor();
   }
}

finishConstructor(data) {
  if (data) { // If data were passed in, add them to the table
    this.dataNode = data[0].n;

    const obj = {};
    obj.data = JSON.parse(JSON.stringify(data));
    app.stripIDs(obj.data);
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  this.buildWidget();
  this.buildDataNode();

  if (data) { // I hate to do this twice, but I have to create dataNode before I can call buildWidget or buildDataNode,
              // and I have to call buildWidget before changing and using DOM elements.
    if (data[0].reason) { // If a reason for trashing was returned (meaning that the node was already trashed by this user)...
      this.dataNode.properties.trash=true;
      this.dataNode.properties.reason = data[0].reason;             // Record in the dataNode that it was trashed already...
      const trashCheck = app.domFunctions.getChildByIdr(this.widgetDOM, "trashCheck");
      trashCheck.checked=true;

      const reason = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
      const reasonText = app.domFunctions.getChildByIdr(this.widgetDOM, 'reasonText');      // Show the reason prompt and textbox...
      reason.removeAttribute("hidden");
      reasonText.removeAttribute("hidden");
      reason.setAttribute("value", data[0].reason);  // And prefill that textbox with the reason.
    }
  }
}

buildWidget() { // public - build table header
  let id=null;  // assume add mode
  let name = "New Node";

  if (this.dataNode) {
    // we are edit mode
    id = this.dataNode.identity;
    name = this.dataNode.properties.name;
  }

  // Make the container a widget
  this.widgetDOM.setAttribute("class", "widget");
  this.widgetDOM.setAttribute("id", this.idWidget);

  // Create a table and append it to the container
  this.tableDOM = document.createElement('table');
  this.widgetDOM.appendChild(this.tableDOM);
  this.tableDOM.setAttribute("idr", "nodeTable");
}

buildDataNode() {   // put in one field label and input row for each field
  let fieldCount = 0;
  let value = "";

  // Clear any existing data
  while (this.tableDOM.hasChildNodes()) {
    this.tableDOM.removeChild(this.tableDOM.firstChild);
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

    const dataField = document.createElement('td');
    row.appendChild(dataField);
    const input = document.createElement('input');
    dataField.appendChild(input);
    input.outerHTML = `<input type = "text" db = ${fieldName} idr = "input${fieldCount++}" onChange = "app.widget('changed',this)" value = "${value}">`
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

  this.tableDOM.appendChild(trashRow);
  app.login.viewLoggedIn.push(trashRow);
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
  const query = `match (user)-[rel:Trash]->(node) where ID(user) = ${user} and ID(node) = ${node} set rel.reason = "${app.stringEscape(reason)}"`;
  this.db.setQuery(query);
  this.db.runQuery(this, "trashUntrash", widgetElement);
}

untrashNode(widgetElement) {
  this.dataNode.properties.trash = false;
  const user = app.login.userID;
  const node = this.dataNode.identity;
  // DBREPLACE DB function: deleteRelation
  // JSON object: {fromID: user; toID: node; type:Trash}
  const query = `match (user)-[rel:Trash]->(node) where ID(user)=${user} and ID(node)=${node} delete rel`;
  this.db.setQuery(query);
  this.db.runQuery(this, "trashUntrash", widgetElement);
}

trashUntrash(data, widgetElement) {
  this.save(widgetElement, data);
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
