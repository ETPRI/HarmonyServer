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
constructor(label, container, GUID, name, callerID) { // Label: the type of node described. ID: the ID of the node. Container: Where to put it
    // DOM pointers to data that will change, just make place holders
    this.widgetDOM   = container;
    this.tableDOM    = {};
    this.tBodyDOM    = null;
    this.fieldPopup  = null;
    this.trashRow    = null;

    this.name                 = name;
    this.id                   = null; // will be filled in later
    this.callerID             = callerID;
    this.queryObject          = app.metaData.getNode(label);
    this.queryObjectName      = label;
    this.nodeLabel            = this.queryObject.nodeLabel;
    this.fields               = this.queryObject.fields;
    this.fieldsDisplayed      = this.queryObject.fieldsDisplayed;
    this.formFieldsDisplayed  = this.queryObject.formFieldsDisplayed;
    this.lastSaveFFD          = this.formFieldsDisplayed;
    this.orderBy              = this.queryObject.orderBy;
    this.newFields            = 0;
    this.hiddenFields         = 0;
    this.dataNode             = null;
    this.showHideFieldsButton = null;

    this.idWidget = app.idCounter;
    app.widgets[app.idCounter++] = this; // Add to app.widgets
    this.containedWidgets = [];

    // If we're editing, then the ID for the node was passed in.
    if (GUID) {
      const obj = {};
      obj.required = {"name":"n", "properties":{"M_GUID":GUID}};
      obj.optional = {"id":app.login.userID, "return":false};
      obj.rel = {"name":"r", "type":"Trash", "direction":"left"};// (n)<-[rel]-(a)

      const xhttp = new XMLHttpRequest();
      const details = this;
      const update = app.startProgress(this.widgetDOM, "Searching for node");

      xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(this.responseText);
          app.stopProgress(details.widgetDOM, update);
          details.finishConstructor(data);
        }
      };

      xhttp.open("POST","");
      const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": app.login.userGUID};
      xhttp.send(JSON.stringify(queryObject));         // send request to server
    }
    else { // If no ID was passed in
       this.finishConstructor();
     }
  }

finishConstructor(data) {
  if (data) { // If data were passed in, add them to the table, and set this.id
    this.id = data[0].n.id;
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
  // let id=null;  // assume add mode
  let name = "New Node";

  if (this.dataNode) {
    // we are edit mode
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
    <p><input type="button" idr="restoreSizeButton" value="Restore textarea to default size"
      onclick="app.widget('restoreSize', this)"></p>
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

  // Show or hide restore size button
  const restoreSize = app.domFunctions.getChildByIdr(this.fieldPopup, 'restoreSizeButton');
  if (this.fields[fieldName].input && this.fields[fieldName].input.name === "textarea") {
    restoreSize.classList.remove("hidden");
  }
  else {
    restoreSize.classList.add("hidden");
  }

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
  const row = formLabel.parentElement;
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
    row.hidden = false;
    row.classList.remove("notShown");
    this.hiddenFields--;
  }

  else if (!(formCheck.checked) && this.formFieldsDisplayed.indexOf(db) != -1) { // If the field shouldn't be displayed and is
    this.formFieldsDisplayed.splice(this.formFieldsDisplayed.indexOf(db), 1);
    row.hidden = true;
    row.classList.add("notShown");
    this.hiddenFields++;
    this.showHideFieldsButton.disabled = false;
    if (this.showHideFieldsButton.value.slice(0, 6) === "Show A") {
      this.showHideFieldsButton.value = `Show All (${this.hiddenFields})`;
    }
  }

  this.fields[db].label = label.value;

  // create or update link
  const obj = {};
  obj.from = {"id":app.login.userID};
  obj.rel = {"type":"Settings", "merge":true};
  obj.to = {"type":"M_MetaData", "properties":{"name":this.queryObjectName}};
  obj.changes = [{"item":"rel", "property":"fields", "value":app.stringEscape(JSON.stringify(this.fields))},
                 {"item":"rel", "property":"fieldsDisplayed", "value":app.stringEscape(JSON.stringify(this.fieldsDisplayed))},
                 {"item":"rel", "property":"formFieldsDisplayed", "value":app.stringEscape(JSON.stringify(this.formFieldsDisplayed))}];

  const xhttp = new XMLHttpRequest();
  const update = app.startProgress(this.widgetDOM, "Updating metadata");
  const details = this;

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      app.stopProgress(details.widgetDOM, update);
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server

  // close popup
  this.fieldPopup.hidden = true;
}

restoreSize(button) {
  const header = app.domFunctions.getChildByIdr(this.fieldPopup, 'popupHeader');
  const db = header.textContent;
  delete this.fields[db].input.height;
  delete this.fields[db].input.width;

  const textareas = Array.from(this.tBodyDOM.getElementsByTagName('textarea'));
  const textarea = textareas.filter(x=>x.getAttribute('db') == db)[0];

  if (textarea) {
    textarea.removeAttribute("style"); // removes the height and width settings
    if (this.fields[db].input && this.fields[db].input.rows) {
      textarea.rows = this.fields[db].input.rows;
    }
    if (this.fields[db].input && this.fields[db].input.cols) {
      textarea.cols = this.fields[db].input.cols;
    }
  }
}

buildDataNode() {   // put in one field label and input row for each field - includes creating dragdrop table
  let fieldCount = 0;
  this.hiddenFields = 0;

  // Clear any existing data
  while (this.tBodyDOM.hasChildNodes()) {
    this.tBodyDOM.removeChild(this.tBodyDOM.firstChild);
  }

  let table = this.tBodyDOM.parentElement;
  let parent = table.parentElement;
  while (table.nextElementSibling) {
    table.parentElement.removeChild(table.nextElementSibling);
  }

  for (let i = 0; i < this.formFieldsDisplayed.length; i++) {
    this.addRow(this.formFieldsDisplayed[i], fieldCount++);
  } // end for (every field to be displayed)

  for (let fieldName in this.fields) {
    if (this.formFieldsDisplayed.indexOf(fieldName) == -1) { // For every hidden field
      const row = this.addRow(fieldName, fieldCount);
      row.setAttribute('class', 'notShown');
      row.hidden = true;
      this.hiddenFields++;
    }
  } // end for (every field in this.fields)

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
  dragDrop.checkDuplicateField = this.checkDuplicateField.bind(this);
  dragDrop.addField = this.addField.bind(this);

  // NOTE: Update the dragdrop drop method to include checking for reordering
  // const oldDrop = dragDrop.drop;
  // dragDrop.drop = function(input, evnt) {
  //   // Get array of fieldnames in current order
  //   // Array of fieldnames in last saved order is this.lastSaveFFD
  //   // Pass the array to app.createLIS along with a comparison function - this.lastSaveFFD.indexOf(a) - this.lastSaveFFD.indexOf(b)
  //   // Go through each row and if its name IS in lastSaveFFD, but ISN'T in the LIS, give it the changedData class.
  //   // If its name ISN'T in lastSaveFFD, give it the newData class.
  //
  //   oldDrop.apply(this, input, evnt);
  // }

  // Create 'Show All' button
  this.showHideFieldsButton = document.createElement("input");
  this.showHideFieldsButton.setAttribute('type', 'button');
  const mainCell = app.domFunctions.getChildByIdr(this.widgetDOM, 'main');
  mainCell.appendChild(this.showHideFieldsButton);
  if (this.hiddenFields == 0) {
    this.showHideFieldsButton.value = "Show All (0)";
    this.showHideFieldsButton.disabled = true;
  }
  else {
    this.showHideFieldsButton.value = `Show All (${this.hiddenFields})`;
    this.showHideFieldsButton.setAttribute('onclick', "app.widget('showHideAllFields', this)");
  }
  this.showHideFieldsButton.setAttribute('style', 'text-align:center');

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

addRow(fieldName, fieldCount) {
  let value = "";

  // Create a table row (in dragDrop table - all "this" references are to dragDrop)
  const row = document.createElement('tr');
  row.setAttribute('ondrop', "app.widget('drop', this, event)");
  row.setAttribute("ondragover", "event.preventDefault()");
  row.setAttribute('ondragstart', "app.widget('drag', this, event)");
  row.setAttribute('draggable', "true");
  row.setAttribute('idr', `tr${fieldName}`);

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
    if (typeof value === "string") { // No need to sanitize data that don't exist, and this can avoid errors when a value is undefined during testing
      value = value.replace(/"/g, "&quot;");
    }
    else {
      value = "";
    }
  }

  const dataField = document.createElement('td');
  row.appendChild(dataField);

  let inputType = "input";
  if (this.fields[fieldName].input && this.fields[fieldName].input.name) {
    inputType = this.fields[fieldName].input.name;
  }
  const input = document.createElement(inputType);

  if (inputType == "input" && this.fields[fieldName].input && this.fields[fieldName].input.size) {
    input.setAttribute("size", this.fields[fieldName].input.size);
  }
  else if (inputType == "textarea") {
    let pixSize = false; // Pixel sizes, set by the user, overrule rows and columns set by default

    if (this.fields[fieldName].input && this.fields[fieldName].input.height) {
      input.setAttribute("style", `height:${this.fields[fieldName].input.height}px; width:${this.fields[fieldName].input.width}px;`);
      pixSize = true;
    }

    if (!pixSize && this.fields[fieldName].input && this.fields[fieldName].input.rows) {
      input.rows = this.fields[fieldName].input.rows;
    }
    if (!pixSize && this.fields[fieldName].input && this.fields[fieldName].input.cols) {
      input.cols = this.fields[fieldName].input.cols;
    }

  }

  dataField.appendChild(input);

  input.setAttribute("db", fieldName);
  input.setAttribute("idr", `input${fieldCount}`);
  input.setAttribute("onchange", "app.widget('changed',this)");
  input.value = value;
  input.setAttribute("onfocus", "this.parentNode.parentNode.draggable = false;");
  input.setAttribute("onblur", "this.parentNode.parentNode.draggable = true;");

  return row;
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

checkDuplicateField(input) {
  let name = input.value;
  let label = "";
  const dupName = (name in this.fields);
  if (dupName) {
    label = this.fields[name].label;
  }
  const dbName = Object.keys(this.fields).find(key => this.fields[key].label === name);
  const dupLabel = (dbName !== undefined);
  if (dupLabel) {
    label = name;
    name = dbName;
  }
  // At this point, if the field exists, name is the DB name and label is the label

  if (dupName || dupLabel) { // If this is a duplicate fieldname or label
    // If this field is not currently displayed (because it's not in formFieldsDisplayed and hidden fields are hidden)
    if (this.formFieldsDisplayed.indexOf(name) === -1 && this.showHideFieldsButton.value.slice(0,6) === "Show A") {
      let text = "This field already exists, but is not displayed. Do you want to display it?";
      if (dupName && name !== label) {
        text = `This field already exists with the label ${label}, but is not displayed. Do you want to display it?`;
      }
      if (confirm(text)) {
        const row = app.domFunctions.getChildByIdr(this.widgetDOM, `tr${name}`, true);
        row.hidden = false;
        row.classList.remove("notShown");
        this.hiddenFields--;
        if (this.hiddenFields === 0) {
          this.showHideFieldsButton.value = `Show All (0)`;
          this.showHideFieldsButton.disabled = true;
        }
        else if (this.showHideFieldsButton.value.slice(0, 6) === "Show A") {
          this.showHideFieldsButton.value = `Show All (${this.hiddenFields})`;
        }
      } // end if (the user agrees to display the hidden field)
    } // end if (the field exists, but is hidden)
    else {
      let text = "This field already exists. Please use the existing field or choose a new name.";
      if (dupName && name !== label) {
        text = `This field already exists with the label ${label}. Please use the existing field or choose a new name.`;
      }
      alert (text);
    } // end else (the field is NOT hidden)
    // Whether the field was hidden or not, whether the user agreed to display it or not, delete the text in this textbox
    input.value = "";
  } // end if (the fieldname exists)
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

addField() {
  const row = document.createElement('tr');
  row.setAttribute('idr', `newFieldRow${this.newFields}`);
  this.tBodyDOM.append(row);

  const nameCell = document.createElement('td');
  row.appendChild(nameCell);
  const nameIn = document.createElement('input');
  nameCell.appendChild(nameIn);
  nameIn.outerHTML = `<input type = "text" idr = "newFieldName${this.newFields}" onChange = "app.widget('changed',this)" onblur = "app.widget('checkDuplicateField', this); app.widget('checkNewField', this)" value = "">`

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
    if (this.dataNode && this.dataNode.properties._trash === true && checkbox.checked === false) { // If the node was trashed and now shouldn't be
      this.untrashNode();
    }                         // I used negation here, rather than checking for === false, because _trash could be undefined.
    else if (this.dataNode && !(this.dataNode.properties._trash === true) && checkbox.checked === true) { // If the node was not trashed and now should be
      this.trashNode();
    }
    else if (this.dataNode && this.dataNode.properties._trash === true && app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason').classList.contains("changedData")) { // If the node was and should stay trashed, but the reason has changed
      this.updateReason();
    }
    else { // If the node's trash status isn't changing, only the data, go straight to save().
      this.save(null, "Save");
    }
  } else { // If we're adding a new node
    this.save(null, "Add");
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
  obj.from = {"id":user, "return":false};
  obj.to = {"id":node, "return":false};
  obj.rel = {"type":"Trash", "merge":true, "properties":{"reason":app.stringEscape(reason)}, "return":false};

  const xhttp = new XMLHttpRequest();
  const details = this;
  const update = app.startProgress(this.widgetDOM, "Trashing node");

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      app.stopProgress(details.widgetDOM, update);
      details.save(data, "Save");
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server
}

updateReason() {
  const user = app.login.userID;
  const node = this.id;
  const reasonInp = app.domFunctions.getChildByIdr(this.widgetDOM, 'trashReason');
  const reason = reasonInp.value;
  this.dataNode.properties.reason = reason;
  reasonInp.setAttribute("class","");

  const obj = {};
  obj.from = {"id":user, "return":false};
  obj.to = {"id":node, "return":false};
  obj.rel = {"type":"Trash", "return":false};
  obj.changes = [{"item":"rel", "property":"reason", "value":app.stringEscape(reason)}];

  const xhttp = new XMLHttpRequest();
  const details = this;
  const update = app.startProgress(this.widgetDOM, "Updating reason");

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      app.stopProgress(details.widgetDOM, update);
      details.save(data, "Save");
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server
}

untrashNode() {
  this.dataNode.properties._trash = false;
  const user = app.login.userID;
  const node = this.id;

  const obj = {};
  obj.from = {"id":user, "return":false};
  obj.to = {"id":node, "return":false};
  obj.rel = {"type":"Trash", "return":false};

  const xhttp = new XMLHttpRequest();
  const details = this;
  const update = app.startProgress(this.widgetDOM, "Restoring node");

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      app.stopProgress(details.widgetDOM, update);
      details.save(data, "Save");
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "deleteRelation", "query": obj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server
}

////////////////////////////////////////////////////////////////////
updateMetaData(newFields) {
  const metadataObj = {};
  metadataObj.from = {"id":app.login.userID, "return":false};
  metadataObj.rel = {"type":"Settings", "merge":true, "return":false};
  metadataObj.to = {"type":"M_MetaData", "name":"metadata", "properties":{"name":this.queryObjectName}};
  metadataObj.changes = [];

  const propertyNames = ['fieldsDisplayed', 'formFieldsDisplayed', 'nodeLabel', 'orderBy', 'fields'];
  for (let i = 0; i < propertyNames.length; i++) {
    const change = {};
    change.item = "rel";
    change.property = propertyNames[i];
    change.value = app.stringEscape(JSON.stringify(this[propertyNames[i]]));
    metadataObj.changes.push(change);
  }

  const xhttp = new XMLHttpRequest();
  const details = this;
  const update = app.startProgress(this.widgetDOM, "Updating metadata");

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const data = JSON.parse(this.responseText);
      app.stopProgress(details.widgetDOM, update);
      details.updateFields(data, newFields);
    }
  };

  xhttp.open("POST","");
  const queryObject = {"server": "CRUD", "function": "changeRelation", "query": metadataObj, "GUID": app.login.userGUID};
  xhttp.send(JSON.stringify(queryObject));         // send request to server
}

updateFields(data, newFields) { // should contain only the metadata node, under the name "metadata"
  if (Object.keys(newFields).length > 0) {
    let fields = JSON.parse(data[0].metadata.properties.fields);
    for (let fieldName in newFields) { // Add all new fields to the fields object
      fields[fieldName] = newFields[fieldName];
    }
    const obj = {};
    obj.node = {"type":"M_MetaData", "properties":{"name":this.queryObjectName}};
    obj.changes = [{"property":"fields", "value":app.stringEscape(JSON.stringify(fields))}];

    const xhttp = new XMLHttpRequest();
    const update = app.startProgress(this.widgetDOM, "Updating metadata");
    const details = this;

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        app.stopProgress(details.widgetDOM, update);
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": app.login.userGUID};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
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

save(trashUntrash, buttonValue) { // Builds query to add or update a node, runs it and passes the results to saveData() or addComplete()
  let tr = this.tBodyDOM.firstElementChild;

  let data = {}; // Data can be an object representing properties (for a new node) or an array of changes (for an existing one)
  if (buttonValue === "Save") {
    data = [];
  }

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

  while (tr) { // goes through all rows - that is, all fields
    const inp = tr.lastElementChild.firstElementChild;  // find <input> element

    // process new fields
    const idr = tr.getAttribute('idr');
    if (idr && idr.slice(0,11) == "newFieldRow") {

      const nameCell = tr.firstElementChild;
      const name = nameCell.firstElementChild.value;
      const valueCell = nameCell.nextElementSibling;
      const value = valueCell.firstElementChild.value;
      if (name != "" && currentFields.indexOf(name) == -1) { // If the field has been filled in, and that name didn't already exist
        const fieldName = name.replace(/\s/g, "").replace(/\(/g, "").replace(/\)/g, "");
        // Add new fields to object. this.fields and app.metadata[name].fields reference the same object so should only have to change one.
        this.fields[fieldName] = {label: name};
        newFields[fieldName] = {label: name};
        this.formFieldsDisplayed.push(fieldName);
        currentFields.push(fieldName);

        // Add field name and value to list of changes
        if (buttonValue === "Save") { // If saving, data is an array of change objects, to pass into CRUD as "obj.changes"
          const change = {};
          change.property = fieldName;
          change.value = app.stringEscape(inp.value);  // assume string
          data.push(change);
        }
        else { // If adding, data is an object where keys are field names and values are field values, to pass into CRUD as "obj.properties"
          data[fieldName] = value;
        }
      }
    }

    // process existing fields
    else {
      currentFields.push(inp.getAttribute("db"));
      const fieldName = inp.getAttribute("db");
      if (this.fields[fieldName] && this.fields[fieldName].input && this.fields[fieldName].input.name === "textarea") {
        this.fields[fieldName].input.height = inp.clientHeight;
        this.fields[fieldName].input.width = inp.clientWidth; // Update local metadata object
      }

      if(buttonValue == "Save" && inp.getAttribute("class") === "changedData") {
        // create a set for this field
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
      else if (buttonValue == "Add") {
        data[inp.getAttribute("db")] = app.stringEscape(inp.value);
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
      if (this.fieldsDisplayed.indexOf(fieldName) !== -1) {
        fieldsDisplayed.push(fieldName);
      }
      // If this field is in this.formFieldsDisplayed (so should also be in formFieldsDisplayed) and isn't a duplicate
      if (this.formFieldsDisplayed.indexOf(fieldName) !== -1 && formFieldsDisplayed.indexOf(fieldName) === -1) {
        formFieldsDisplayed.push(fieldName);
      }
      fields[fieldName] = this.fields[fieldName];
    }
    this.fields = fields;
    app.metaData.node[this.queryObjectName].fields = fields;
    this.fieldsDisplayed = fieldsDisplayed;
    app.metaData.node[this.queryObjectName].fieldsDisplayed = fieldsDisplayed;
    this.formFieldsDisplayed = formFieldsDisplayed;
    app.metaData.node[this.queryObjectName].formFieldsDisplayed = formFieldsDisplayed;
  }

  // I used to make this optional - done only if a change needed to be made -
  // but as more and more possible changes appear, that gets less practical.
  // I think I'll just go ahead and update the settings every time.
  this.lastSaveFFD = this.formFieldsDisplayed; // Reflects formFieldsDisplayed at last save
  this.updateMetaData(newFields);

  if (data.length == 0) { //This should only ever come up when saving - both because adding uses an object, not an array, for data and because adding should add every field to data every time.
    if (trashUntrash) { // If the node was trashed or untrashed (meaning data were passed in), but no other changes need to be made, don't bother to run an empty query or refresh the widget, but do log the fact that addSave was clicked.
      const obj = {};
      obj.id = this.idWidget;
      obj.idr = "addSaveButton";
      obj.action = "click";
      app.regression.log(JSON.stringify(obj));
      app.regression.record(obj);
    // If the node was NOT trashed or untrashed AND there were no changes to fields, AND this is a standalone node
    // (because if it's a calendar or mindmap, the user may be saving changes other than the ones shown by details),
    // then just alert that there were no changes. No need to log in this case.
  } else if (this.widgetDOM.parentElement === document.getElementById("widgets")) {
    alert("No changes to save");
    }
  }
  else {
    const xhttp = new XMLHttpRequest();
    const details = this;
    const update = app.startProgress(this.widgetDOM, "Saving node");

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const data = JSON.parse(this.responseText);
        app.stopProgress(details.widgetDOM, update);
        if (buttonValue === "Save") {
          details.saveData(data);
        }
        else {
          details.addComplete(data);
        }
      }
    };

    let obj = {};
    let queryObject = {};

    if (buttonValue === "Save") {
      obj.node = {"name":"n", "id":this.id};
      obj.changes = data;
      queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": app.login.userGUID};
    }
    else {
      obj = {"name":"n", "type":this.queryObjectName, "properties":data};
      queryObject = {"server": "CRUD", "function": "createNode", "query": obj, "GUID": app.login.userGUID};
    }

    xhttp.open("POST","");
    xhttp.send(JSON.stringify(queryObject));         // send request to server
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
