this.widgetDOM/*
widgetTableNodes

display, search, add/edit on nodes ******************

*/

class widgetTableNodes {
////////////////////////////////////////////////////////////////////
  // tableName
  // id - for document.getElementById(id)
  constructor (queryObjectName, controlId) { // name of a query Object, and ID of the control that requested it
    this.queryObjectName      = queryObjectName;
    this.queryObject          = app.metaData.getNode(queryObjectName);
    this.fields               = this.queryObject.fields;
    this.fieldsDisplayed      = this.queryObject.fieldsDisplayed;
    this.formFieldsDisplayed  = this.queryObject.formFieldsDisplayed;
    this.limitDefault         = 9;
    this.widgetDOM            = null;

    this.requests             = [];

    this.idWidget = app.idCounter;   // strings
    this.searchTrigger = controlId;
    this.fieldPopup = app.setUpPopup(this);

    this.buildHeader();  //  show table header on screen
    this.widgetDOM.appendChild(this.fieldPopup);

    if (app.activeWidget) {
      app.activeWidget.classList.remove("activeWidget");
    }
    app.activeWidget = this.widgetDOM;
    this.widgetDOM.classList.add("activeWidget");

    this.data = null;

    this.search();       // do search with no criteria
  }

  ////////////////////////////////////////////////////////////////////
  search(criteria) { // public - call when data changes
    if (criteria && criteria.length > 0) { // if search criteria were passed in, process them first
      this.reset(); // clear all existing search criteria
      for (let i = 0; i < criteria.length; i++) {
        const name = criteria[i].name;
        const value = criteria[i].value;
        const ddValue = criteria[i].dropDownValue;
        if ((value !== undefined) && name && name in this.fields) { // If this criterion has a valid name and value
          if (this.fieldsDisplayed.indexOf(name) < 0) { // If the given field was hidden
            this.fieldsDisplayed.push(name); // show it
            this.updateFields(); // I don't THINK I need a whole refresh here - the search that's about to run will do the data
          }
          const cell = app.domFunctions.getChildByIdr(this.widgetDOM, `searchCell${name}`);
          const inp = cell.firstElementChild;
          const drop = cell.lastElementChild;
          inp.value = value;
          if (ddValue) { // If a dropdown value was given
            drop.value = ddValue;
          } // end if (a dropdown value was given)
        } // end if (a valid name and value were given)
      } // end for (every item in the criteria array)
    } // end if (search criteria were passed in)

    app.sendQuery(this.buildQuery, "tableNodeSearch", `Searching for ${this.queryObject.nodeLabel}`, this.widgetDOM, function(data) {
      this.data = data;
      this.refresh();
    }.bind(this));

    // const xhttp = new XMLHttpRequest();
    // const nodes = this;
    // const queryObject = {"server": "CRUD", "function": "tableNodeSearch", "query": this.buildQuery(), "GUID": app.login.userGUID};
    // const request = JSON.stringify(queryObject);
    // const update = app.startProgress(this.widgetDOM, `Searching for ${this.queryObject.nodeLabel}`, request.length);
    //
    // xhttp.onreadystatechange = function() {
    //   if (this.readyState == 4 && this.status == 200) {
    //     app.stopProgress(nodes.widgetDOM, update, this.responseText.length);
    //     nodes.data = JSON.parse(this.responseText);
    //     nodes.refresh();
    //   }
    // };
    //
    // xhttp.open("POST","");
    // xhttp.send(request);         // send request to server
  }

  searchOnEnter(input, evnt) { // Makes hitting enter run a search
    if (evnt.keyCode === 13) {
      this.search();
    }
  }

  reset() {
    const widget = document.getElementById(this.idWidget); // Get the widget to clear
    const inputs = widget.getElementsByTagName('input'); // Get all inputs (text boxes and buttons)
    for (let i = 0; i < inputs.length; i++) { // Go through them all...
      if (inputs[i].type !== "button") { // ignoring the buttons...
        inputs[i].value = ""; // and clear the text boxes
      }
    }
    app.domFunctions.getChildByIdr(this.widgetDOM, "limit").value = this.limitDefault; // reset limit
    const ownerBox = app.domFunctions.getChildByIdr(this.widgetDOM, "ownerText");
    if (ownerBox) {
      ownerBox.value = app.login.userName; // reset owner
    }

    const dropdowns = widget.getElementsByTagName('select');
    for (let i = 0; i < dropdowns.length; i++) {
      dropdowns[i].selectedIndex = 0;
    }

    // Clear required links
    const row = document.getElementById('dropNodes');
    row.innerHTML = `<td>Required Links:</td><td id="dropNode0" ondragover="event.preventDefault()" ondrop="app.dropLink(this, event)"></td>`;
  }

  refresh() {
    this.updateFields();
    this.buildData();
  }

  buildQuery() { // public - called when search criteria change
    const obj = {};
    obj.name = "n";
    obj.type = this.queryObjectName;
    obj.where = this.buildWhere();
    obj.orderBy = this.queryObject.orderBy;
    obj.limit = app.domFunctions.getChildByIdr(this.widgetDOM, "limit").value;
    obj.links = [];

    const row = document.getElementById('dropNodes');
    const cells = row.children;

    for (let cell of cells) {
      if (cell.getAttribute('GUID')) {
        obj.links.push(cell.getAttribute('GUID'));
      }
    }

    obj.owner = this.buildOwner();

    if (obj.type == "people") {
      const dropDown = app.domFunctions.getChildByIdr(this.widgetDOM, "permissionsDropdown");
      obj.permissions = dropDown.options[dropDown.selectedIndex].value;
    }
    return obj;
  }

  buildWhere() {
    /*   output - nameLast =~"(?i)Bol.*"
    */  // <tr><th><input>  must go up 2 levels to get to tr
    const th  = app.domFunctions.getChildByIdr(this.widgetDOM, "headerRow").firstElementChild.children; // get collection of th

    let where = {};
    // iterate siblings of input
    for(let i=2; i<th.length; i++) {
      const inputDOM = th[i].firstElementChild;  // <input>  tag
      // If the text input exists, has a value and has a db attribute (meaning it represents a property field)
      if (inputDOM && inputDOM.tagName == 'INPUT' && 0 < inputDOM.value.length && inputDOM.getAttribute('db')) {
        const dropDown = inputDOM.nextElementSibling;
        // get value of search type
        const searchType = dropDown.options[dropDown.selectedIndex].value;

        const field = inputDOM.getAttribute('db');
        where[field] = {};
        where[field].value = inputDOM.value;
        where[field].searchType = searchType;

        if (dropDown.options[0].value === "S") {
          where[field].fieldType = "string";
        }
        else {
          where[field].fieldType = "number";
        }
      }
    }
    return where;
  }

  buildOwner() {
    let owner = null;
    const cell = app.domFunctions.getChildByIdr(document.getElementById(this.idWidget), 'ownerSearch');
    if (cell) {
      const text = cell.firstElementChild;
      const dropDown = text.nextElementSibling;
      if (text.value.length > 0) {
        owner = {};
        owner.value = text.value;
        owner.searchType = dropDown.options[dropDown.selectedIndex].value;
      }
    }
    return owner;
  }

  ////////////////////////////////////////////////////////////////////
  buildHeader() {
    // build header
    let addText = "";
    if (this.queryObjectName !== "all") {
      addText = `<input type="button" value="Add" idr = "addButton" onclick="app.widget('addNode',this)">`;
    }
    const html = `${app.widgetHeader('widgetTableNodes')}
    <b>${this.queryObject.nodeLabel}:${this.queryObjectName}</b>${addText}
    <input type="button" value="Search" idr="searchButton" onclick="app.widgetSearch(this)">
    <input type="button" value="Reset" idr="clearButton" onclick="app.widget('reset', this)">
    limit <input value ="${this.limitDefault}" idr="limit" style="width: 20px;" onblur = "app.regression.logText(this)" onkeydown="app.widget('searchOnEnter', this, event)">
    </span>
    <input type="button" class="hidden" idr="cancelButton" value="Cancel" onclick="app.stopProgress(this)">
    </div>

    <div class="widgetBody freezable">
      <table>
        <thead idr = "headerRow">
        <tr idr="headerSearch"></tr>
        <tr idr="header"></tr>
        </thead>
        <tbody idr = "data"> </tbody>
      </table>
      </div>
      <!-- popup goes here -->
    </div>
    `

    const html2 = html.replace('ondrop="app.drop(this, event)" ondragover="event.preventDefault()"', ""); // Disable ondrop - can't rearrange search tables anymore

    /*
    Create new element and append to tableHeader widget
    */
    const parent = document.getElementById('tableHeader');
    let newWidget = document.createElement('div'); // create placeholder div
    parent.append(newWidget); // Insert the new div before the first existing one
    newWidget.outerHTML = html2; // replace placeholder with the div that was just written

    // make the new widget hidden, and give it a descriptive ID and special class
    this.widgetDOM = document.getElementById(this.idWidget);
    this.widgetDOM.classList.add("hidden");
    this.widgetDOM.setAttribute('id', this.queryObjectName);
    this.idWidget = this.queryObjectName;
    this.widgetDOM.classList.add('tableWidget');

    this.fieldSelectPopup = document.createElement("div");
    this.fieldSelectPopup.setAttribute("hidden", "true");
    this.fieldSelectPopup.setAttribute('class', 'fieldPopup');
    this.fieldSelectPopup.setAttribute('idr', 'fieldSelect');
    this.fieldSelectPopup.innerHTML =
    `<div class="popupHeader" idr="popupHeader">Select fields to show:</div>
    <div>
      <div idr="fieldList"></div>
      <p>
        <input type="button" value="OK" onclick = "app.widget('fieldSelectOK', this)">
    		<input type="button" value="Cancel" onclick="app.widget('fieldSelectCancel', this)">
      </p>
    </div>`;
    this.widgetDOM.appendChild(this.fieldSelectPopup);

    this.updateFields();
  }

  fieldSelect(button) {
    this.fieldSelectPopup.hidden = false;
    const bounds = button.parentElement.getBoundingClientRect();
    this.fieldSelectPopup.setAttribute("style", `left:${bounds.left + window.scrollX}px; top:${bounds.top + window.scrollY}px`);

    let list = app.domFunctions.getChildByIdr(this.fieldSelectPopup, 'fieldList');
    list.innerHTML = "";

    for (let prop in this.fields) {
      let classText = "listField";
      if (this.fieldsDisplayed.indexOf(prop) >= 0) { // If this property is shown on the table
        classText += " selectedField";
      }
      list.innerHTML += `<p idr=${prop} onclick="this.classList.toggle('selectedField')" class="${classText}">${this.fields[prop].label}</p>`;
    }
  }

  fieldSelectCancel() {
    this.fieldSelectPopup.hidden = true;
  }

  fieldSelectOK() {
    let list = app.domFunctions.getChildByIdr(this.fieldSelectPopup, 'fieldList');
    let fields = list.children;
    for (let i = 0; i < fields.length; i++) {
      const name = fields[i].getAttribute('idr'); // The idr is the DB name of the field
      if (fields[i].classList.contains('selectedField') && this.fieldsDisplayed.indexOf(name) < 0) { // if this field wasn't shown but now should be
        this.fieldsDisplayed.push(name); // add to end of fieldsDisplayed
      }
      else if (!(fields[i].classList.contains('selectedField')) && this.fieldsDisplayed.indexOf(name) >= 0) { // if this field was shown but shouldn't be
        this.fieldsDisplayed.splice(this.fieldsDisplayed.indexOf(name), 1); // remove from fieldsDisplayed
      }
    }

    const obj = {};
	  obj.from = {"id":app.login.userID};
	  obj.rel = {"type":"Settings", "merge":true};
	  obj.to = {"type":"M_MetaData", "properties":{"name":this.queryObjectName}};
	  obj.changes = [{"item":"rel", "property":"fieldsDisplayed", "value":app.stringEscape(JSON.stringify(this.fieldsDisplayed))}];

    app.sendQuery(obj, "changeRelation", "Updating metadata", this.widgetDOM);

    // const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
    // const request = JSON.stringify(queryObject);
    //
    // const xhttp = new XMLHttpRequest();
    // const update = app.startProgress(this.widgetDOM, "Updating metadata", request.length);
    // const table = this;
    //
    // xhttp.onreadystatechange = function() {
    //   if (this.readyState == 4 && this.status == 200) {
    //     app.stopProgress(table.widgetDOM, update, this.responseText.length);
    //   }
    // };
    //
    // xhttp.open("POST","");
    // xhttp.send(request);         // send request to server

    this.fieldSelectPopup.hidden = true;
    this.refresh();
  }

  updateFields() {
    const strSearch = `
    <select idr = "dropdown#x#", onclick = "app.regression.logSearchChange(this)">
    <option value="S">S</option>
    <option value="M">M</option>
    <option value="E">E</option>
    <option value="=">=</option>
    </select></th>`;

    const numSearch = `
    <select idr = "dropdown#x#" onclick = "app.regression.logSearchChange(this)">
    <option value=">">&gt;</option>
    <option value=">=">&gt;=</option>
    <option value="=">=</option>
    <option value="<=">&lt;=</option>
    <option value="<">&lt;</option>
    </select></th>`;

    let buttonHTML = '';
    if (this.queryObjectName != 'all') {
      buttonHTML = `<input type="button" value="Field Select" onclick="app.widget('fieldSelect', this)">`;
    }

    let headerSearch = app.domFunctions.getChildByIdr(this.widgetDOM, 'headerSearch');
    let searchCells = Array.from(headerSearch.children);

    // build search part of buildHeader
    let s=`<th>${buttonHTML}</th><th hidden></th>`;
    for (let i=0; i<this.fieldsDisplayed.length; i++ ) {
        const fieldName =this.fieldsDisplayed[i];
        const cell = searchCells.find(x=>x.getAttribute('db') === fieldName);
        let text = "";
        let select = "";
        if (cell) { // if the cell exists, its first child is a text input and its second is a dropdown
          text = cell.firstElementChild.value;
          const dropDown = cell.lastElementChild;
          select = dropDown.options[dropDown.selectedIndex].value; // get their values and plug them into the new HTML
        }

        let s1 = `<th db="${fieldName}" idr="searchCell${fieldName}" ondragstart="app.widget('dragHeader', this, event)"
                  ondragover="event.preventDefault()" ondrop="app.widget('dropHeader', this, event)" draggable="true">
                    <input idr = "text${i}" db="#1" size="7" onblur="app.regression.logText(this)"
                    onkeydown="app.widget('searchOnEnter', this, event)" value="${text}">`;
        if (this.fields && this.fields[fieldName] && this.fields[fieldName].type === "number") {
          // number search
          s1 += numSearch.replace('#x#', i);
        } else {
          // assume string search
          s1 += strSearch.replace('#x#', i);
        }
        s += s1.replace('#1',fieldName).replace(`<option value="${select}">`, `<option selected value="${select}">`);
    }

    if (this.queryObjectName.slice(0,2) !== 'M_') { // metadata nodes don't have owners
      let ownerInput = app.domFunctions.getChildByIdr(this.widgetDOM, 'ownerText');
      let ownerValue = app.login.userName;
      if (ownerInput) { // If the owner field existed already, don't reset it
        ownerValue = ownerInput.value;
      }

      s += `<th idr = "ownerSearch">`;
      s += `<input idr = "ownerText" size="7" value = "${ownerValue}" onblur="app.regression.logText(this)" onkeydown="app.widget('searchOnEnter', this, event)">`
      s += strSearch.replace('#x#', 'owner');
      s += `</th>`;
    }

    if (this.queryObjectName == 'people') {
      s += `<th colspan = "3">
            <select idr="permissionsDropdown">
              <option value="all">All people</option>
              <option value="allUsers">Users and Admins</option>
              <option value="users">Users</option>
              <option value="admins">Admins</option>
            </select>
          </th>`;
    }

    headerSearch.innerHTML = s;

    // build field name part of header
    let f="<th>#</th><th hidden>ID</th>";
    for (let i=0; i<this.fieldsDisplayed.length; i++ ) {
        const fieldName =this.fieldsDisplayed[i];
        f += `<th db="${fieldName}" oncontextmenu= "event.preventDefault(); app.widget('showPopup', this)" draggable="true"
        ondragstart="app.widget('dragHeader', this, event)" ondragover="event.preventDefault()" ondrop="app.widget('dropHeader', this, event)">
        ${this.fields[fieldName].label}</th>`;
    }

    if (this.queryObjectName.slice(0,2) !== 'M_') { // metadata nodes don't have owners
      f += '<th>Owner</th>';
    }

    if (this.queryObjectName == 'people') {
      f += '<th colspan = "3">Permissions</th>'
    }

    let header = app.domFunctions.getChildByIdr(this.widgetDOM, 'header');
    header.innerHTML = f;
  }

  buildData() {  // build dynamic part of table
    let html = "";
    const r = this.data;
    let rowCount = 1;
    let cell; // the cell currently being built
    let row; // the row currently being built
    let text; // the text to go in the cell
    const table = app.domFunctions.getChildByIdr(this.widgetDOM, "data");

    // Delete what's already in the table
    while (table.hasChildNodes()) {
      table.removeChild(table.firstChild);
    }

    for (let i=0; i<r.length; i++) {
      // Create a row
      row = document.createElement('tr');

      // Create a cell for rowCount and append it
      cell = document.createElement('td');
      row.appendChild(cell);
      cell.outerHTML = `<td idr = "edit${i}" onclick="app.widget('edit',this)" draggable="true" ondragstart="app.widget('drag', this, event)">${rowCount++}</td>`;

      // Create a cell for ID and append it
      cell = document.createElement('td');
      row.appendChild(cell);
      cell.outerHTML = `<td hidden>${r[i].n.properties.M_GUID}</td>`;

      if (this.queryObjectName === "all") {
        r[i].n.properties.type = r[i].n.labels[0];
      }

      // For each display field, create a cell and append it
      for (let j=0; j<this.fieldsDisplayed.length; j++) {
        cell = document.createElement('td');
        const fieldName = this.fieldsDisplayed[j];
        if (this.fieldsDisplayed[j] == 'name') { // Make the name cell draggable
          cell.setAttribute("draggable", "true");
          cell.setAttribute("ondragstart", "app.widget('drag', this, event)");
          cell.setAttribute("idr", `name${i}`);
        }
        text = document.createTextNode(r[i]["n"].properties[fieldName]);
        cell.appendChild(text);
        row.appendChild(cell);
      }

      if (this.queryObjectName.slice(0,2) !== 'M_') { // If this is not a metadata node, it has (or may have) an owner
        let owner = "None";
        if (r[i].owner) {
          owner = r[i].owner;
        }
        cell = document.createElement('td');          // Make a cell showing its owner...
        text = document.createTextNode(owner);
        cell.appendChild(text);
        row.appendChild(cell);
      }

      // If this is a people table...
      if (this.queryObjectName == "people") {
        let permissions = "None";
        if (r[i].permissions) {
          permissions = r[i].permissions;
        }
        cell = document.createElement('td');          // Make a cell showing their permissions...
        text = document.createTextNode(permissions);
        cell.appendChild(text);
        row.appendChild(cell);

        cell = document.createElement('td');          // and one with a button to add/remove User status...
        const userButton = document.createElement('input');
        userButton.setAttribute("type", "button");
        userButton.setAttribute("idr", "changeUser");
        cell.appendChild(userButton);
        row.appendChild(cell);

        if (app.login.permissions != "Admin") {
          cell.setAttribute("hidden", "true");
        }
        app.login.viewAdmin.push(cell);

        cell = document.createElement('td');          // and one with a button to add/remove Admin status
        const adminButton = document.createElement('input');
        adminButton.setAttribute("type", "button");
        adminButton.setAttribute("idr", "changeAdmin");
        cell.appendChild(adminButton);
        row.appendChild(cell);

        if (app.login.permissions != "Admin") {
          cell.setAttribute("hidden", "true");
        }
        app.login.viewAdmin.push(cell);

        if (permissions == "None") {
          userButton.setAttribute("value", "Make User");
          userButton.setAttribute("onclick", "app.widget('givePermission', this)");

          adminButton.setAttribute("value", "Make Admin");
          adminButton.setAttribute("onclick", "app.widget('findPermission', this)");
        }
        else if (permissions == "User") {
          userButton.setAttribute("value", "Remove User");
          userButton.setAttribute("onclick", "app.widget('removePermission', this)");

          adminButton.setAttribute("value", "Make Admin");
          adminButton.setAttribute("onclick", "app.widget('findPermission', this)");
        }
        else if (permissions == "Admin") {
          userButton.setAttribute("value", "Remove User");
          userButton.setAttribute("onclick", "app.widget('removePermission', this)");

          adminButton.setAttribute("value", "Remove Admin");
          adminButton.setAttribute("onclick", "app.widget('findPermission', this)");
        }
      }

      // Append the whole row to the data table
      table.appendChild(row);
    }

    // New code for creating a JSON object
    const obj = {};
    obj.id = this.searchTrigger;
    if (obj.id == this.idWidget) { // If the call for the search came from this widget, then record the idr of the search button and that it was clicked.
      obj.idr = "searchButton";
      obj.action = "click";
    }
    if (obj.id == "menuNodes") { // If the call came from the menuNodes dropdown, then record the value of the dropDown and that it was selected.
      const dropDown = document.getElementById('menuNodes');
    	obj.value = dropDown.options[dropDown.selectedIndex].value;
      obj.action = "click";
    }
    if (obj.id == "New") { // If the call came from the New button, just record that it was clicked.
      obj.action = "click";
    }

    obj.data = JSON.parse(JSON.stringify(this.data)); // This should make a COPY of data, so deleting its identity won't affect the original.
    for (let i = 0; i< obj.data.length; i++) { // Trying to remove the IDs from the log - they're not particularly useful, and can cause problems because they rarely match
      delete obj.data[i].n.identity;
    }
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  drag(input, evnt){ // stores information about a node in the drag event. input is the thing being dragged.
    const nodeRow = input.parentElement;
    const nameColumn = this.fieldsDisplayed.indexOf('name') + 2; // The first two cells in the table aren't included in fieldsDisplayed
    let name = "";
    if (nameColumn > 1) { // If that call to indexOf didn't return -1 (-1 would mean there isn't actually a name field in this table)
      const nameCell = nodeRow.children[nameColumn];
      name = nameCell.textContent;
    }
    const IDcell = nodeRow.children[1]; // The ID will always be the second cell in the table, after the number
    const ID = IDcell.textContent;
    let type = this.queryObject.nodeLabel;
    if (type == "All Nodes") {
      const typeCell = nodeRow.children[2]; // If this came from the "All Nodes" table, get the correct label...
      type = typeCell.textContent;
    }
    let DBType = this.queryObjectName;
    if (DBType == "all") {
      const typeCell = nodeRow.children[2]; // and the correct DB name
      type = typeCell.textContent;
      const fieldNames = Object.keys(app.metaData.node);
      DBType = fieldNames.find(fieldName => app.metaData.node[fieldName].nodeLabel == type);
    }

    const data = {};
    data.name = name;
    data.type = type;
    data.DBType = DBType;
    data.nodeID = ID;
    data.details = [];
    for (let i = 0; i< this.fieldsDisplayed.length; i++) { // For every displayed field...
      const cell = nodeRow.children[i+2]; // Remember that the first two cells aren't displayed fields
      const fieldName = this.fieldsDisplayed[i];
      if (fieldName != "name") { // skip the name...
        const detailObj = {};
        detailObj.field = fieldName;
        detailObj.value = cell.textContent;
        data.details.push(detailObj);
      }
    }
    data.sourceID = app.domFunctions.widgetGetId(input);
    data.sourceType = "widgetTableNodes";
    data.sourceTag = input.tagName;
    evnt.dataTransfer.setData("text/plain", JSON.stringify(data));

    const obj = {};
    obj.id = app.domFunctions.widgetGetId(evnt.target);
    obj.idr = event.target.getAttribute("idr");
    obj.action = "dragstart";
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  dragHeader(input, evnt) {
    const data = {};
    data.name = input.getAttribute('db');
    data.sourceID = app.domFunctions.widgetGetId(input);
    data.sourceTag = input.tagName;
    evnt.dataTransfer.setData("text/plain", JSON.stringify(data));
  }

  dropHeader(target, evnt) {
    const data = JSON.parse(evnt.dataTransfer.getData("text/plain"));
    if (data.sourceID === this.idWidget && data.sourceTag === "TH") { // we are rearranging columns
      const sourceIndex = this.fieldsDisplayed.indexOf(data.name);
      const targetIndex = this.fieldsDisplayed.indexOf(target.getAttribute('db'));
      if (sourceIndex >=0 && targetIndex >= 0) { // both items are in fieldsDisplayed -- SHOULD always be the case
        this.fieldsDisplayed.splice(sourceIndex, 1); // remove from old location
        // NOTE: If source was before target, will splice in after target because removing source moved target to left
        this.fieldsDisplayed.splice(targetIndex, 0, data.name); // put back just before original target location

        const obj = {};
    	  obj.from = {"id":app.login.userID};
    	  obj.rel = {"type":"Settings", "merge":true};
    	  obj.to = {"type":"M_MetaData", "properties":{"name":this.queryObjectName}};
    	  obj.changes = [{"item":"rel", "property":"fieldsDisplayed", "value":app.stringEscape(JSON.stringify(this.fieldsDisplayed))}];

        app.sendQuery(obj, "changeRelation", "Updating metadata", this.widgetDOM);

        // const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
        // const request = JSON.stringify(queryObject);
        //
        // const xhttp = new XMLHttpRequest();
        // const update = app.startProgress(this.widgetDOM, "Updating metadata", request.length);
        // const table = this;
        //
        // xhttp.onreadystatechange = function() {
        //   if (this.readyState == 4 && this.status == 200) {
        //     app.stopProgress(table.widgetDOM, update, this.responseText.length);
        //   }
        // };
        //
        // xhttp.open("POST","");
        // xhttp.send(request);         // send request to server
        this.refresh();
      }
    }
  }

  edit(element){
    // NOTE: This is brittle - assumes that an element can only be edited by clicking the row number,
    // and that the ID is always next to the row number. Think about changing later.
    const idCell = element.nextElementSibling;
    const id = idCell.innerHTML; // the id is in the next (hidden) cell

    let type = this.queryObjectName;
    if (type === "all") { // If this is an "all" table, extract the type from the type cell (the first visible one after the row number)
      type = idCell.nextElementSibling.innerHTML;
    }

    if (type == 'mindmap') {
      new widgetSVG(this.idWidget, id);
    }
    else if (type == "calendar") {
      new widgetCalendar(this.idWidget, id);
    }
    else {
      new widgetNode(this.idWidget, type, id);
    }
    // log
    const obj = {};
    obj.id = app.domFunctions.widgetGetId(element);
    obj.idr = element.getAttribute("idr");
    obj.action = "click";
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  // open add widget
  addNode(element){
    // Get the name searched for, if any
    const widget = document.getElementById(this.idWidget);
    const nameColumn = this.fieldsDisplayed.indexOf('name'); // The first two cells in the table aren't included in fieldsDisplayed
    let name = "";
    if (nameColumn > -1) { // If that call to indexOf didn't return -1 (-1 would mean there isn't actually a name field in this table)
      const nameInput = app.domFunctions.getChildByIdr(widget, `text${nameColumn}`);
      name = nameInput.value;
    }

    if (this.queryObject.nodeLabel == 'mindmap') {
      new widgetSVG(this.idWidget, null, name);
    }
    else if (this.queryObject.nodeLabel == "calendar") {
      new widgetCalendar(this.idWidget, null, name);
    }
    else {
      new widgetNode(this.idWidget, this.queryObjectName, null, name);
    }

    // log
    const obj = {};
    obj.id = app.domFunctions.widgetGetId(element);
    obj.idr = element.getAttribute("idr");
    obj.action = "click";
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  findPermission(button) {
    // Get ID of the person to check
    const row = button.parentElement.parentElement;
    const GUID = row.children[1].textContent;

    // Determine which permission to check for (and delete if found), and which to add
    let toAdd = "";
    let toRemove = "";

    const space = button.value.indexOf(" ");
    const addRemove = button.value.slice(0,space); // The button should be either "Make Admin" or "Remove Admin"
    if (addRemove == "Make") {
      toAdd = "Admin";
    }
    else if (addRemove == "Remove") {
      toAdd = "User";
    }

    // If this user has a relation to ANY login table, find it (and later, extract login details and delete it)
    const obj = {};
    obj.from = {"properties":{"M_GUID":GUID}, "return":false};
    obj.to = {"type":"M_LoginTable", "return":false};
    obj.rel = {"type":"Permissions"};

    app.sendQuery(obj, "changeRelation", "Checking permissions", this.widgetDOM, this.checkPermission.bind(this), GUID, button, toAdd);

    // const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
    // const request = JSON.stringify(queryObject);
    //
    // const xhttp = new XMLHttpRequest();
    // const nodes = this;
    // const update = app.startProgress(this.widgetDOM, "Checking permissions", request.length);
    //
    // xhttp.onreadystatechange = function() {
    //   if (this.readyState == 4 && this.status == 200) {
    //     const data = JSON.parse(this.responseText);
    //     app.stopProgress(nodes.widgetDOM, update, this.responseText.length);
    //     nodes.checkPermission(data, GUID, button, toAdd);
    //   }
    // };
    //
    // xhttp.open("POST","");
    // xhttp.send(request);         // send request to server
  }

  checkPermission(data, GUID, button, toAdd) {
    if (data.length > 0 && data[0].rel.properties.username && data[0].rel.properties.password) { // If a relation to delete was found
      const obj = {};
      obj.rel = {"id":data[0].rel.id, "return":false};

      app.sendQuery(obj, "deleteRelation", "Deleting old permissions", this.widgetDOM, function(data, button, toAdd, GUID) {
        this.givePermission(button, toAdd, GUID, data[0].rel.properties.username, data[0].rel.properties.password);
      }.bind(this), button, toAdd, GUID);

      // const queryObject = {"server": "CRUD", "function": "deleteRelation", "query": obj, "GUID": app.login.userGUID};
      // const request = JSON.stringify(queryObject);
      //
      // const xhttp = new XMLHttpRequest();
      // const nodes = this;
      // const update = app.startProgress(this.widgetDOM, "Deleting old permissions", request.length);
      //
      // xhttp.onreadystatechange = function() {
      //   if (this.readyState == 4 && this.status == 200) {
      //     app.stopProgress(nodes.widgetDOM, update, this.responseText.length);
      //     nodes.givePermission(button, toAdd, GUID, data[0].rel.properties.username, data[0].rel.properties.password);
      //   }
      // };
      //
      // xhttp.open("POST","");
      // xhttp.send(request);         // send request to server
    }

    else { // If there was no relation to delete, need to ask for a new username and password
      let password;
      const username = prompt("Enter the username:", "");
      if (username) {
        password = prompt("Enter the password:", "");
      }

      // If they entered data, create a link from them to the Admin table
      if (username && password) {
        this.givePermission(button, toAdd, GUID, username, password);
      }
    }
  }

  givePermission(button, toAdd, GUID, name, password) {
    if (!(toAdd && GUID && name && password)) { // if all information needed was NOT passed in
      const row = button.parentElement.parentElement;
      GUID = row.children[1].textContent;

      name = prompt("Enter the username:", "");
      if (name) {
        password = prompt("Enter the password:", "");
      }

      // We should be making a new user (if we were making an admin, the info would be passed in), but check the button just in case.
      if (button.value == "Make User") {
        toAdd = "User";
      }
    } // end if (info was not passed in)

    if (toAdd && GUID && name && password) { // if the user has entered data, not cancelled
      const obj = {};
      obj.from = {"properties":{"M_GUID":GUID}, "return":false};
      obj.to = {"type":"M_LoginTable", "properties":{"name":toAdd}, "return":false};
      obj.rel = {"type":"Permissions", "properties":{"username":name, "password":password}, "return":false};

      app.sendQuery(obj, "createRelation", "Setting permission", this.widgetDOM, function() {
        this.search();
      }.bind(this));

      // const queryObject = {"server": "CRUD", "function": "createRelation", "query": obj, "GUID": app.login.userGUID};
      // const request = JSON.stringify(queryObject);
      //
      // const xhttp = new XMLHttpRequest();
      // const nodes = this;
      // const update = app.startProgress(this.widgetDOM, "Setting permissions", request.length);
      //
      // xhttp.onreadystatechange = function() {
      //   if (this.readyState == 4 && this.status == 200) {
      //     const data = JSON.parse(this.responseText);
      //     app.stopProgress(nodes.widgetDOM, update, this.responseText.length);
      //     nodes.search(data);
      //   }
      // };
      //
      // xhttp.open("POST","");
      // xhttp.send(request);         // send request to server
    }
  }

  removePermission(button) { // Remove ALL permissions from this user
    const row = button.parentElement.parentElement;
    const GUID = row.children[1].textContent;

    const obj = {};
    obj.from = {"properties":{"M_GUID":GUID}, "return":false};
    obj.to = {"type":"M_LoginTable", "return":false};
    obj.rel = {"type":"Permissions", "return":false};

    app.sendQuery(obj, "deleteRelation", "Removing permissions", this.widgetDOM, function() {
      this.search();
    }.bind(this));

    // const queryObject = {"server": "CRUD", "function": "deleteRelation", "query": obj, "GUID": app.login.userGUID};
    // const request = JSON.stringify(queryObject);
    //
    // const xhttp = new XMLHttpRequest();
    // const nodes = this;
    // const update = app.startProgress(this.widgetDOM, "Removing permissions", request.length);
    //
    // xhttp.onreadystatechange = function() {
    //   if (this.readyState == 4 && this.status == 200) {
    //     app.stopProgress(nodes.widgetDOM, update, this.responseText.length);
    //     nodes.search();
    //   }
    // };
    //
    // xhttp.open("POST","");
    // xhttp.send(JSON.stringify(queryObject));         // send request to server
  }
} ////////////////////////////////////////////////////// end class widgetTableNodes
