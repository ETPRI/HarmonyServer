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


class widgetDetails {
constructor(label, container, id, name, callerID) { // Label: the type of node described. ID: the ID of the node. Container: Where to put it
    // DOM pointers to data that will change, just make place holders
    this.widgetDOM   = container;
    this.tableDOM    = {};

    this.name                 = name;
    this.callerID             = callerID;
    this.queryObject          = app.metaData.getNode(label);
    this.queryObjectName      = label;
    this.nodeLabel            = this.queryObject.nodeLabel;
    this.fields               = this.queryObject.fields;
    this.fieldsDisplayed      = this.queryObject.fieldsDisplayed;
    this.formFieldsDisplayed  = this.queryObject.formFieldsDisplayed;
    this.orderBy              = this.queryObject.orderBy;
    this.newFields            = 0;
    this.id                   = id;

    this.idWidget = app.idCounter;
    app.widgets[app.idCounter++] = this; // Add to app.widgets
    this.containedWidgets = [];

    // If we're editing, then the ID for the node was passed in.
    if (id) {
      const obj = {};
      obj.required = {};
      obj.required.name = "n";
      obj.required.id = id;
      obj.optional = {};
      obj.optional.id = app.login.userID;
      obj.optional.return = false;
      obj.rel = {};
      obj.rel.name = "r";
      obj.rel.type = "Trash";
      obj.rel.direction = "left"; // (n)<-[rel]-(a)
      app.nodeFunctions.findOptionalRelation(obj, this, 'finishConstructor');
    }
    else { // If no ID was passed in
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

  else {
  }

  this.buildWidget();
  this.buildDataNode();

  if (data) { // I hate to do this twice, but I have to create dataNode before I can call buildWidget or buildDataNode, and I have to call buildWidget before changing and using DOM elements.
    if (data[0].r) { // If a trash relation was returned (meaning that the node was already trashed by this user)...
      this.dataNode.properties._trash=true;
      this.dataNode.properties.reason = data[0].r.properties.reason; // Record in the dataNode that it was trashed already...
      const trashCheck = app.domFunctions.getChildByIdr(this.widgetDOM, "trashCheck");
      trashCheck.checked=true;

      const reason = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
      const reasonText = app.domFunctions.getChildByIdr(this.widgetDOM, 'reasonText');      // Show the reason prompt and textbox...
      reason.removeAttribute("hidden");
      reasonText.removeAttribute("hidden");
      reason.setAttribute("value", data[0].r.properties.reason); // And prefill that textbox with the reason.
    }
  }
}

buildWidget() { // public - build table header
  let id=null;  // assume add mode
  let name = "New Node";

  if (this.dataNode) {
    // we are edit mode
    id = this.id;
    name = this.dataNode.properties.name;
  }

  // Make the container a widget
  this.widgetDOM.classList.add("widget");
  this.widgetDOM.setAttribute("id", this.idWidget);
  const main = document.createElement('div');
  main.setAttribute('idr', 'main');
  this.widgetDOM.appendChild(main);

  // Create a table and append it to the container
  this.tableDOM = document.createElement('table');
  main.appendChild(this.tableDOM);
  this.tableDOM.setAttribute("idr", "nodeTable");
  this.tBodyDOM = document.createElement('tbody');
  this.tBodyDOM.setAttribute("idr", "nodeTBody");
  this.tableDOM.appendChild(this.tBodyDOM);

  // create popup
  this.fieldPopup = document.createElement("div");
  this.fieldPopup.setAttribute("hidden", "true");
  this.fieldPopup.setAttribute('class', 'fieldPopup')
  this.fieldPopup.innerHTML =
  `<div class="popupHeader" idr="popupHeader"></div>
  <div>
    <p>Display Name: <input idr="labelInput" type="text"></p>
    <p><input idr="showTable" type="checkbox"> Show this field in the table</p>
    <p><input idr="showForm" type="checkbox"> Show this field in the detailed form</p>
    <p><input type="button" value="OK" onclick = "app.widget('popupOK', this)">
    <input type="button" value="Cancel" onclick="app.widget('popupCancel', this)"></p>
  </div>
  `

  this.fieldPopup.setAttribute("idr", "fieldPopup");
  this.widgetDOM.appendChild(this.fieldPopup);

}

showPopup(label) {
  this.fieldPopup.hidden = false;
  const bounds = label.getBoundingClientRect();
  this.fieldPopup.setAttribute("style", `left:${bounds.left + window.scrollX}px; top:${bounds.top + window.scrollY}px`);
  // set text in popup header to "actual" field name (stored as db of label)
  const fieldName = label.getAttribute('db');
  const header = app.domFunctions.getChildByIdr(this.fieldPopup, 'popupHeader');
  header.innerHTML = fieldName;
  // set text in label textbox to "label" field name (stored as text of label)
  const labelInput = app.domFunctions.getChildByIdr(this.fieldPopup, 'labelInput');
  labelInput.value = label.textContent;

  const tableCheck = app.domFunctions.getChildByIdr(this.fieldPopup, 'showTable');
  if (this.fieldsDisplayed.indexOf(fieldName) != -1) {
    tableCheck.checked = true;
  }
  else {
    tableCheck.checked = false;
  }
  const formCheck = app.domFunctions.getChildByIdr(this.fieldPopup, 'showForm');
  if (this.formFieldsDisplayed.indexOf(fieldName) != -1) {
    formCheck.checked = true;
  }
  else {
    formCheck.checked = false;
  }
}

popupCancel() {
  this.fieldPopup.hidden = true;
}

popupOK(button) {
  // Get the DOM elements and the db name of the field being edited
  const header = app.domFunctions.getChildByIdr(this.fieldPopup, 'popupHeader');
  const label = app.domFunctions.getChildByIdr(this.fieldPopup, 'labelInput');
  const tableCheck = app.domFunctions.getChildByIdr(this.fieldPopup, 'showTable');
  const formCheck = app.domFunctions.getChildByIdr(this.fieldPopup, 'showForm');
  const db = header.textContent;
  const formLabel = app.domFunctions.getChildByIdr(this.widgetDOM, `th${db}`, true);
  formLabel.innerText = label.value;

  // update metadata class
  if (tableCheck.checked && this.fieldsDisplayed.indexOf(db) == -1) { // If the field should be displayed and currently isn't
    this.fieldsDisplayed.push(db);
  }

  else if (!(tableCheck.checked) && this.fieldsDisplayed.indexOf(db) != -1) { // If the field shouldn't be displayed and is
    this.fieldsDisplayed.splice(this.fieldsDisplayed.indexOf(db), 1);
  }

  if (formCheck.checked && this.formFieldsDisplayed.indexOf(db) == -1) { // If the field should be displayed and currently isn't
    this.formFieldsDisplayed.push(db);
  }

  else if (!(formCheck.checked) && this.formFieldsDisplayed.indexOf(db) != -1) { // If the field shouldn't be displayed and is
    this.formFieldsDisplayed.splice(this.formFieldsDisplayed.indexOf(db), 1);
  }

  this.fields[db].label = label.value;

  // create or update link
  const obj = {};
  obj.from = {};
  obj.from.id = app.login.userID;
  obj.rel = {};
  obj.rel.type = "Settings";
  obj.rel.merge = true;
  obj.to = {};
  obj.to.type = "M_MetaData";
  obj.to.properties = {};
  obj.to.properties.name = this.queryObjectName;
  obj.changes = [];
  const fields = {};
  fields.item = 'rel';
  fields.property = "fields";
  fields.value = app.stringEscape(JSON.stringify(this.fields));
  obj.changes.push(fields);
  const fieldsDisplayed = {};
  fieldsDisplayed.item = 'rel';
  fieldsDisplayed.property = "fieldsDisplayed";
  fieldsDisplayed.value = app.stringEscape(JSON.stringify(this.fieldsDisplayed));
  obj.changes.push(fieldsDisplayed);
  const formFieldsDisplayed = {};
  formFieldsDisplayed.item = 'rel';
  formFieldsDisplayed.property = "formFieldsDisplayed";
  formFieldsDisplayed.value = app.stringEscape(JSON.stringify(this.formFieldsDisplayed));
  obj.changes.push(formFieldsDisplayed);

  app.nodeFunctions.changeRelation(obj);
  // close popup
  this.fieldPopup.hidden = true;
}

buildDataNode() {   // put in one field label and input row for each field - includes creating dragdrop table
  let fieldCount = 0;
  let value = "";
  let hiddenFields = 0;

  // Clear any existing data
  while (this.tBodyDOM.hasChildNodes()) {
    this.tBodyDOM.removeChild(this.tBodyDOM.firstChild);
  }

  let table = this.tBodyDOM.parentElement;
  let parent = table.parentElement;
  while (table.nextElementSibling) {
    table.parentElement.removeChild(table.nextElementSibling);
  }

  for (let fieldName in this.fields) {

    // Create a table row
    const row = document.createElement('tr');
    row.setAttribute('ondrop', "app.widget('drop', this, event)");
    row.setAttribute("ondragover", "app.widget('allowDrop', this, event)");
    row.setAttribute('ondragstart', "app.widget('drag', this, event)");
    row.setAttribute('draggable', "true")

    if (this.formFieldsDisplayed.indexOf(fieldName) == -1) { // If the field shouldn't be visible
      row.setAttribute('class', 'notShown');
      row.hidden = true;
      hiddenFields++;
    }

    this.tBodyDOM.appendChild(row);

    // Create the first cell, a th cell containing the label as text
    const header = document.createElement('th');
    row.appendChild(header);
    const labelText = document.createTextNode(this.fields[fieldName].label);
    header.appendChild(labelText);
    header.setAttribute('oncontextmenu', "event.preventDefault(); app.widget('showPopup', this)");
    header.setAttribute('db', fieldName);
    header.setAttribute('idr', `th${fieldName}`);

    // Create the second cell, a td cell containing an input which has an idr, an onChange event, and a value which may be an empty string
    if (this.dataNode) {
      const d=this.dataNode.properties;
      value = d[fieldName];
      if (value) { // No need to sanitize data that don't exist, and this can avoid errors when a value is undefined during testing
        value = value.replace(/"/g, "&quot;");
      }
      else {
        value = "";
      }
    }

    const dataField = document.createElement('td');
    row.appendChild(dataField);
    const input = document.createElement('input');
    dataField.appendChild(input);
    input.outerHTML = `<input type = "text" db = ${fieldName} idr = "input${fieldCount++}" onChange = "app.widget('changed',this)" value = "${value}">`
    value="";
  }

  this.containedWidgets.push(app.idCounter); // The dragDrop table will be a widget, so add it to the list of "widgets the widgetNode contains"
  // Create the new dragDrop table
  const dragDrop = new dragDropTable(null, "nodeTBody", this.widgetDOM, 0, 0);

  // NOTE: Can't stop dragDrop from creating inputs, so instead I'll reset the th idr at the end for now. Feels kludgy, though.
  const lastRow = app.domFunctions.getChildByIdr(this.tableDOM, 'insertContainer', true);
  const th = lastRow.firstElementChild;
  th.setAttribute('idr', `th${th.getAttribute('db')}`);

  dragDrop.showPopup = this.showPopup.bind(this);
  dragDrop.changed = this.changed.bind(this);
  dragDrop.checkNewField = this.checkNewField.bind(this);
  dragDrop.addField = this.addField.bind(this);


  // Create 'Show All' button
  const button = document.createElement("input");
  const mainCell = app.domFunctions.getChildByIdr(this.widgetDOM, 'main');
  mainCell.appendChild(button);
  if (hiddenFields == 0) {
    button.outerHTML = `<input type="button" value="Show All (0)" disabled>`;
  }
  else {
    button.outerHTML = `<input type="button" value="Show All (${hiddenFields})" onclick = "app.widget('showHideAllFields', this)">`;
  }
  button.setAttribute('style', 'text-align:center');

  const trashHTML = `<b>Trash Node</b>
                <input type="checkbox" onclick="app.widget('toggleReason', this)" idr="trashCheck">
                <b idr="reasonText" hidden="true">Reason: </b>
                <input type="text" hidden="true" onblur="app.widget('changed', this)" idr="trashReason" db="reason">`;

  this.trashRow = document.createElement('div');
  mainCell.appendChild(this.trashRow);
  this.trashRow.innerHTML = trashHTML;

  if (this.dataNode && this.dataNode.properties._trash) {
    const checkbox = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashCheck');
    const reason = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
    const reasonText = app.domFunctions.getChildByIdr(this.widgetDOM, 'reasonText');
    checkbox.checked = true; // Check the box...
    reason.removeAttribute("hidden"); // Show the reason prompt and textbox...
    reasonText.removeAttribute("hidden");
    reason.setAttribute("value", this.dataNode.properties.reason); // And prefill that textbox with the reason.
  }

  // set the button to be save or added
  if (this.addSaveDOM) {
    if (this.dataNode) {
      this.addSaveDOM.value = "Save";
    }
    else {
      this.addSaveDOM.value = "Add";
    }
  }

  // Create new field box
  this.addField();
}

showHideAllFields(button) {
  const hiddenFields = this.tBodyDOM.getElementsByClassName('notShown');
  switch(button.value.slice(0,9)) {
    case 'Show All ':
      for (let i = 0; i < hiddenFields.length; i++) {
        hiddenFields[i].hidden = false;
      }
      button.value = "Show Less";
      break;
    case 'Show Less':
    for (let i = 0; i < hiddenFields.length; i++) {
      hiddenFields[i].hidden = true;
    }
    button.value = `Show All (${hiddenFields.length})`;
    break;
  }
}

checkNewField() {
  const rows = this.tBodyDOM.children;
  let add = true;
  for (let i = 0; i < rows.length; i++) {
    const idr = rows[i].getAttribute('idr');
    if (idr && idr.slice(0,11) == 'newFieldRow') { // This is a new field row
      const nameCell = rows[i].firstElementChild;
      const valueCell = nameCell.nextElementSibling;
      if (nameCell.firstElementChild.value == "" && valueCell.firstElementChild.value == "") { // both inputs are empty
        add = false;
        break;
      }
    }
  }
  // If all rows have been checked, and there are no empty ones, create a new one.
  if (add) {
    this.addField();
  }
}

addField(textbox) {
  const row = document.createElement('tr');
  row.setAttribute('idr', `newFieldRow${this.newFields}`);
  this.tBodyDOM.append(row);

  const nameCell = document.createElement('td');
  row.appendChild(nameCell);
  const nameIn = document.createElement('input');
  nameCell.appendChild(nameIn);
  nameIn.outerHTML = `<input type = "text" idr = "newFieldName${this.newFields}" onChange = "app.widget('changed',this)" onblur = "app.widget('checkNewField', this)" value = "">`

  const valueCell = document.createElement('td');
  row.appendChild(valueCell);
  const valueIn = document.createElement('input');
  valueCell.appendChild(valueIn);
  valueIn.outerHTML = `<input type = "text" idr = "newFieldValue${this.newFields++}" onChange = "app.widget('changed',this)" onblur = "app.widget('checkNewField', this)" value = "">`
}

saveAdd(widgetElement) { // Saves changes or adds a new node
  // director function
  if (widgetElement == null || widgetElement.value === "Save") {
    const checkbox = app.domFunctions.getChildByIdr(this.widgetDOM, "trashCheck");
    if (this.dataNode && this.dataNode.properties._trash === true && checkbox.checked === false && app.login.userID) { // If the node was trashed and now shouldn't be
      this.untrashNode();
    }
    else if (this.dataNode && !(this.dataNode.properties._trash === true) && checkbox.checked === true && app.login.userID) { // If the node was not trashed and now should be
      this.trashNode();
    }
    else if (this.dataNode && this.dataNode.properties._trash === true && app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason').classList.contains("changedData") && app.login.userID) { // If the node was and should stay trashed, but the reason has changed
      this.updateReason();
    }
    else { // If the node's trash status isn't changing, only the data, go straight to save().
      this.save();
    }
  } else {
    this.add();
  }
}

trashNode() {
  this.dataNode.properties._trash = true;
  const user = app.login.userID;
  const node = this.id;
  const reasonInp = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
  const reason = reasonInp.value;
  reasonInp.setAttribute("class",""); // remove changedData class from reason

  const obj = {};
  obj.from = {};
  obj.from.id = user;
  obj.from.return = false;
  obj.to = {};
  obj.to.id = node;
  obj.to.return = false;
  obj.rel = {};
  obj.rel.type = "Trash";
  obj.rel.merge = true;
  obj.rel.properties = {};
  obj.rel.properties.reason = app.stringEscape(reason);
  obj.rel.return = false;
  app.nodeFunctions.createRelation(obj, this, 'trashUntrash');
}

updateReason() {
  const user = app.login.userID;
  const node = this.id;
  const reasonInp = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
  const reason = reasonInp.value;
  this.dataNode.properties.reason = reason;
  reasonInp.setAttribute("class","");

  const obj = {};
  obj.from = {};
  obj.from.id = user;
  obj.from.return = false;
  obj.to = {};
  obj.to.id = node;
  obj.to.return = false;
  obj.rel = {};
  obj.rel.type = "Trash";
  obj.rel.return = false;
  obj.changes = [];
  const change = {};
  change.item = "rel";
  change.property = "reason";
  change.value = app.stringEscape(reason);
  obj.changes.push(change);
  app.nodeFunctions.changeRelation(obj, this, 'trashUntrash');
}

untrashNode() {
  this.dataNode.properties._trash = false;
  const user = app.login.userID;
  const node = this.id;

  const obj = {};
  obj.from = {};
  obj.from.id = user;
  obj.from.return = false;
  obj.to = {};
  obj.to.id = node;
  obj.to.return = false;
  obj.rel = {};
  obj.rel.type = "Trash";
  obj.rel.return = false;
  app.nodeFunctions.deleteRelation(obj, this, 'trashUntrash');
}

trashUntrash(data) {
  this.save(data);
}

////////////////////////////////////////////////////////////////////
add() { // Builds a query to add a new node, then runs it and passes the result to addComplete
  let tr = this.tBodyDOM.firstElementChild;

  let data={};
  let newFields = {};
  let reordered = false;
  let currentFields = [];

  const label = app.domFunctions.getChildByIdr(this.widgetDOM, 'nodeTypeLabel');
  const labelText = label.textContent;
  const renamed = (labelText != this.nodeLabel);
  if (renamed) { // update metadata nodeLabel object
    this.nodeLabel = labelText;
    this.queryObject.nodeLabel = labelText;
  }

  while (tr) {
    const inp = tr.lastElementChild.firstElementChild;

    if (inp && inp.hasAttribute("db")) { //  Process input rows with a db value - ones corresponding to existing fields
      data[inp.getAttribute("db")] = app.stringEscape(inp.value);
      currentFields.push(inp.getAttribute("db"));
    }

    // process rows with new fields
    const idr = tr.getAttribute('idr')
    if (idr && idr.slice(0,11) == "newFieldRow") {
      const nameCell = tr.firstElementChild;
      name = nameCell.firstElementChild.value;
      const valueCell = nameCell.nextElementSibling;
      const value = valueCell.firstElementChild.value;
      if (name != "") {
        const fieldName = name.replace(/\s/g, "");
        // Add new field to object. this.fields and app.metadata[name].fields reference the same object so should only have to change one.
        this.fields[fieldName] = {label: name};
        newFields[fieldName] = {label: name};
        data[fieldName] = value;
        currentFields.push(fieldName);
      }
    }
    tr=tr.nextElementSibling;
  }

  // Build a string listing the fields from the form (done above) and a string listing the fields from the field object.
  // If they don't match, need to update the order of fields in fields, fieldsDisplayed and formFieldsDisplayed.
  let oldFields = [];
  for (let fieldName in this.fields) {
    oldFields.push(fieldName);
  }
  reordered = (JSON.stringify(oldFields) != JSON.stringify(currentFields));
  if (reordered) {
    let fields = {};
    let fieldsDisplayed = [];
    let formFieldsDisplayed = [];
    for (let i = 0; i < currentFields.length; i++) {
      const fieldName = currentFields[i];
      fieldsDisplayed.push(fieldName);
      formFieldsDisplayed.push(fieldName);
      fields[fieldName] = this.fields[fieldName];
    }
    this.fields = fields;
    app.metaData.node[this.queryObjectName].fields = fields;
    this.fieldsDisplayed = fieldsDisplayed;
    app.metaData.node[this.queryObjectName].fieldsDisplayed = fieldsDisplayed;
    this.formFieldsDisplayed = formFieldsDisplayed;
    app.metaData.node[this.queryObjectName].formFieldsDisplayed = formFieldsDisplayed;
  }

  // Change metadata node if needed
  if (Object.keys(newFields).length > 0 || renamed || reordered) {
    this.updateMetaData(newFields);
  }

  const obj = {};
  obj.name = "n";
  obj.type = this.queryObjectName;
  obj.properties = data;
  app.nodeFunctions.createNode(obj, this, 'addComplete');
}

updateMetaData(newFields) {
  const metadataObj = {};
  metadataObj.from = {};
  metadataObj.from.id = app.login.userID;
  metadataObj.from.return = false;
  metadataObj.rel = {};
  metadataObj.rel.type = "Settings";
  metadataObj.rel.merge = true;
  metadataObj.rel.return = false;
  metadataObj.to = {};
  metadataObj.to.type = "M_MetaData";
  metadataObj.to.name = "metadata";
  metadataObj.to.properties = {};
  metadataObj.to.properties.name = this.queryObjectName;
  metadataObj.changes = [];

  const propertyNames = ['fieldsDisplayed', 'formFieldsDisplayed', 'nodeLabel', 'orderBy'];
  for (let i = 0; i < propertyNames.length; i++) {
    const change = {};
    change.item = "rel";
    change.property = propertyNames[i];
    change.value = app.stringEscape(JSON.stringify(this[propertyNames[i]]));
    metadataObj.changes.push(change);
  }
  app.nodeFunctions.changeRelation(metadataObj, this, 'updateFields', newFields);
}

updateFields(data, newFields) { // should contain only the metadata node, under the name "metadata"
  if (Object.keys(newFields).length > 0) {
    let fields = JSON.parse(data[0].metadata.properties.fields);
    for (let fieldName in newFields) { // Add all new fields to the fields object
      fields[fieldName] = newFields[fieldName];
    }
    const obj = {};
    obj.node = {};
    obj.node.type = "M_MetaData";
    obj.node.properties = {};
    obj.node.properties.name = this.queryObjectName;
    obj.changes = [];
    const update = {};
    update.property = "fields";
    update.value = app.stringEscape(JSON.stringify(fields));
    obj.changes.push(update);
    app.nodeFunctions.changeNode(obj);
  }
}

addComplete(data) { // Refreshes the node table and logs that addSave was clicked
  this.dataNode = data[0].n; // takes single nodes
  this.id = this.dataNode.id;
  const id = this.id;
  const name = this.dataNode.properties.name;
  const nodeLabel = app.domFunctions.getChildByIdr(this.widgetDOM, "nodeLabel");
  nodeLabel.textContent=`${this.nodeLabel}#${id}: ${name}`;

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

save(trashUntrash) { // Builds query to update a node, runs it and passes the results to saveData()
  let tr = this.tBodyDOM.firstElementChild;

  let data = [];
  let newFields = {};
  let reordered = false;
  let currentFields = [];

  const label = app.domFunctions.getChildByIdr(this.widgetDOM, 'nodeTypeLabel');
  const labelText = label.textContent;
  const renamed = (labelText != this.nodeLabel);
  if (renamed) { // update metadata nodeLabel object
    this.nodeLabel = labelText;
    this.queryObject.nodeLabel = labelText;
  }

  while (tr) {
    const inp = tr.lastElementChild.firstElementChild;  // find <input> element

    // process new fields
    const idr = tr.getAttribute('idr');
    if (idr && idr.slice(0,11) == "newFieldRow") {

      const nameCell = tr.firstElementChild;
      const name = nameCell.firstElementChild.value;
      const valueCell = nameCell.nextElementSibling;
      const value = valueCell.firstElementChild.value;
      if (name != "") {
        const fieldName = name.replace(/\s/g, "");
        // Add new fields to object. this.fields and app.metadata[name].fields reference the same object so should only have to change one.
        this.fields[fieldName] = {label: name};
        newFields[fieldName] = {label: name};
        this.formFieldsDisplayed.push(fieldName);
        currentFields.push(fieldName);

        // Add field name and value to list of changes
        const change = {};
        change.property = fieldName;
        change.value = app.stringEscape(inp.value);  // assume string
        data.push(change);
      }
    }

    // process existing fields
    else {
      currentFields.push(inp.getAttribute("db"));
      if(inp.getAttribute("class") === "changedData") {
        // create a set for this field
        const fieldName = inp.getAttribute("db");
        if (fieldName in this.fields) {
          const change = {};
          change.property = fieldName;
          if (this.fields[fieldName].type === "number") {
            change.value = inp.value;
            change.string = false;
          } else {
            change.value = app.stringEscape(inp.value);  // assume string
          }
          data.push(change);
        }
      }
    }

    tr=tr.nextElementSibling;
  }

  // Build a string listing the fields from the form (done above) and a string listing the fields from the field object.
  // If they don't match, need to update the order of fields in fields, fieldsDisplayed and formFieldsDisplayed.
  let oldFields = [];
  for (let fieldName in this.fields) {
    oldFields.push(fieldName);
  }
  reordered = (JSON.stringify(oldFields) != JSON.stringify(currentFields));
  if (reordered) {
    let fields = {};
    let fieldsDisplayed = [];
    let formFieldsDisplayed = [];
    for (let i = 0; i < currentFields.length; i++) {
      const fieldName = currentFields[i];
      fieldsDisplayed.push(fieldName);
      formFieldsDisplayed.push(fieldName);
      fields[fieldName] = this.fields[fieldName];
    }
    this.fields = fields;
    app.metaData.node[this.queryObjectName].fields = fields;
    this.fieldsDisplayed = fieldsDisplayed;
    app.metaData.node[this.queryObjectName].fieldsDisplayed = fieldsDisplayed;
    this.formFieldsDisplayed = formFieldsDisplayed;
    app.metaData.node[this.queryObjectName].formFieldsDisplayed = formFieldsDisplayed;
  }

  // Change metadata node if needed
  if (Object.keys(newFields).length > 0 || renamed || reordered) {
    this.updateMetaData(newFields);
  }

  if (data===[]) {
    if (trashUntrash) { // If the node was trashed or untrashed, but no other changes need to be made, don't bother to run an empty query or refresh the widget, but do log the fact that addSave was clicked.
      const obj = {};
      obj.id = this.idWidget;
      obj.idr = "addSaveButton";
      obj.action = "click";
      app.regression.log(JSON.stringify(obj));
      app.regression.record(obj);
    } else { // If the node was NOT trashed or untrashed AND there were no changes to fields, just alert that there were no changes. No need to log in this case.
    alert("No changes to save")
    }
  }
  else {
    const obj = {};
    obj.node = {};
    obj.node.name = "n";
    obj.node.id = this.id;
    obj.changes = data;

    app.nodeFunctions.changeNode(obj, this, 'saveData');
  }
}

saveData(data) { // Refreshes the node table and logs that addSave was clicked
  // redo from as edit now that data is saved
  this.dataNode = data[0].n;
  // Keep the trash relation shown in the table
  const text = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
  const checkbox = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashCheck');
  if (checkbox.checked) {
    this.dataNode.properties._trash = true;
    this.dataNode.properties.reason = text.value;
  }
  else {
    this.dataNode.properties._trash = false;
  }
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
  const reason = app.domFunctions.getChildByIdr(this.trashRow, 'trashReason');
  const reasonText = app.domFunctions.getChildByIdr(this.trashRow, 'reasonText');

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
