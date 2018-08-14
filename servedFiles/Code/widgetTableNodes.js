/*
widgetTableNodes

display, search, add/edit on nodes ******************

*/

class widgetTableNodes {
////////////////////////////////////////////////////////////////////
  // tableName
  // id - for document.getElementById(id)
  constructor (queryObjectName, controlId) { // name of a query Object, and ID of the control that requested it
    this.queryObjectName = queryObjectName;
    this.queryObject     = app.metaData.getNode(queryObjectName);
    this.fields          = this.queryObject.fields;
    this.fieldsDisplayed = this.queryObject.fieldsDisplayed;
    this.queryData       = {}; // where returned data will be stored

    this.idWidget = app.idCounter;   // strings
    this.searchTrigger = controlId;

    this.buildHeader();  //  show table header on screen
    this.widget = document.getElementById(this.idWidget);

    if (app.activeWidget) {
      app.activeWidget.classList.remove("activeWidget");
    }
    app.activeWidget = this.widget;
    this.widget.classList.add("activeWidget");

    this.search();       // do search with no criteria
  }

  ////////////////////////////////////////////////////////////////////
  search() { // public - call when data changes
    app.nodeFunctions.tableNodeSearch(this.buildQuery(), this, 'buildData');
  }

  searchOnEnter(input, evnt) { // Makes hitting enter run a search
    if (evnt.keyCode === 13) {
      this.search();
    }
  }

  buildQuery() { // public - called when search criteria change
    const obj = {};
    obj.name = "n";
    obj.type = this.queryObject.nodeLabel;
    obj.where = this.buildWhere();
    obj.orderBy = this.queryObject.orderBy;
    obj.limit = app.domFunctions.getChildByIdr(this.widget, "limit").value;

    if (obj.type == 'mindmap') {
      obj.owner = this.buildOwner();
    }

    if (obj.type == "people") {
      const dropDown = app.domFunctions.getChildByIdr(this.widget, "permissionsDropdown");
      obj.permissions = dropDown.options[dropDown.selectedIndex].value;
    }
    return obj;
  }

  buildWhere() {
    /*   output - nameLast =~"(?i)Bol.*"
    */  // <tr><th><input>  must go up 2 levels to get to tr
    const th  = app.domFunctions.getChildByIdr(this.widget, "headerRow").firstElementChild.children; // get collection of th

    let where = {};
    // iterate siblings of input
    for(let i=2; i<th.length; i++) {
      const inputDOM = th[i].firstElementChild;  // <input>  tag
      // If the text input exists, has a value and has a db attribute (meaning it represents a property field)
      if (inputDOM && inputDOM.tagName == 'INPUT' && 0 < inputDOM.value.length && inputDOM.getAttribute('db')) {
        const dropDown = inputDOM.nextElementSibling;
        // get value of search type
        const searchType = dropDown.options[dropDown.selectedIndex].value;

        const field = this.getAtt(inputDOM,"fieldName");
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

  getAtt(element,attName) { // private -----------
  	/*
    input - element - is DOM input Object
            attName - name of attribute in db
    return - attribute value from db
  	*/
    const ret = element.getAttribute("db").split(attName+":")[1].split(";")[0].trim();
  	return(ret);
  }

  buildOwner() {
    const cell = app.domFunctions.getChildByIdr(document.getElementById(this.idWidget), 'ownerSearch');
    const text = cell.firstElementChild;
    const dropDown = text.nextElementSibling;
    let owner = null;
    if (text.value.length > 0) {
      owner = {};
      owner.value = text.value;
      owner.searchType = dropDown.options[dropDown.selectedIndex].value;
    }
    return owner;
  }

  ////////////////////////////////////////////////////////////////////
  buildHeader() {
    // build header
    const html = app.widgetHeader()
    +'<b> '+this.queryObject.nodeLabel +":"+ this.queryObjectName +` </b>
    <input type="button" value="Add" idr = "addButton" onclick="app.widget('addNode',this)">
    <input type="button" value="Search" idr = "searchButton" onclick="app.widgetSearch(this)">
    limit <input value ="9" idr = "limit" style="width: 20px;" onblur = "app.regression.logText(this)" onkeydown="app.widget('searchOnEnter', this, event)">
    </div>

    <table>
      <thead idr = "headerRow">
      <tr><th></th><th></th>#headerSearch#</tr>
      <tr><th>#</th><th>ID</th>#header#</tr>
      </thead>
      <tbody idr = "data"> </tbody>
    </table>
    <!-- popup goes here -->
    </div>
    `

    const strSearch = `
    <select idr = "dropdown#x#", onclick = "app.regression.logSearchChange(this)">
    <option value="S">S</option>
    <option value="M">M</option>
    <option value="E">E</option>
    <option value="=">=</option>
    </select></th>`

    const numSearch = `
    <select idr = "dropdown#x#" onclick = "app.regression.logSearchChange(this)">
    <option value=">">&gt;</option>
    <option value=">=">&gt;=</option>
    <option value="=">=</option>
    <option value="<=">&lt;=</option>
    <option value="<">&lt;</option>
    </select></th>`

    // build search part of buildHeader
    let s="";
    for (let i=0; i<this.fieldsDisplayed.length; i++ ) {
        const fieldName =this.fieldsDisplayed[i];
        let s1 = `<th><input idr = "text${i}" db="fieldName: #1" size="7" onblur="app.regression.logText(this)" onkeydown="app.widget('searchOnEnter', this, event)">`
        if (this.fields[fieldName].type === "number") {
          // number search
          s1 += numSearch.replace('#x#', i);
        } else {
          // assume string search
          s1 += strSearch.replace('#x#', i);
        }
        s += s1.replace('#1',fieldName)
    }
    if (this.queryObjectName == 'mindmap') {
      s += `<th idr = "ownerSearch">`;
      s += `<input idr = "ownerText" size="7" value = "${app.login.userName}" onblur="app.regression.logText(this)" onkeydown="app.widget('searchOnEnter', this, event)">`
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

    const html4 = html.replace('#headerSearch#',s)

    // build field name part of header
    let f="";
    for (let i=0; i<this.fieldsDisplayed.length; i++ ) {
        const fieldName =this.fieldsDisplayed[i];
        //f += "<th onClick='app.widgetSort(this)'>"+ this.fields[fieldName].label + "</th>" ;
        // The original version of this line called a method that doesn't exist yet.
        // If we build that method eventually, we can put the old version of the line back.
        f += "<th>"+ this.fields[fieldName].label + "</th>" ;
    }
    if (this.queryObjectName == 'mindmap') {
      f += '<th>Owner</th>';
    }
    if (this.queryObjectName == 'people') {
      f += '<th colspan = "3">Permissions</th>'
    }
    const html5 = html4.replace('#header#',f);

    /*
    Create new element, append to the widgets div in front of existing widgets
    */
    const parent = document.getElementById('widgets');
    const child = parent.firstElementChild;
    const newWidget = document.createElement('div'); // create placeholder div
    parent.insertBefore(newWidget, child); // Insert the new div before the first existing one
    newWidget.outerHTML = html5; // replace placeholder with the div that was just written
  }

  buildData(data) {  // build dynamic part of table
    this.queryData = data; // only one row should have been returned
    let html = "";
    const r = data;
    let rowCount = 1;
    let cell; // the cell currently being built
    let row; // the row currently being built
    let text; // the text to go in the cell
    const table = app.domFunctions.getChildByIdr(this.widget, "data");

    // Delete what's already in the table
    while (table.hasChildNodes()) {
      table.removeChild(table.firstChild);
    }

    for (let i=0; i<r.length; i++) {
      // Create a row
      row = document.createElement('tr');

      // Create a cell for rowCount and append it
      cell = document.createElement('td');
      text = document.createTextNode(rowCount++);
      cell.appendChild(text);
      row.appendChild(cell);

      // Create a cell for ID and append it
      cell = document.createElement('td');
      row.appendChild(cell);
      cell.outerHTML = `<td idr = "edit${i}" onClick="app.widget('edit',this)" draggable="true" ondragstart="app.widget('drag', this, event)">${r[i]["n"].id}</td>`;

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

      // If this is a mindmap table
      if (this.queryObjectName == 'mindmap') {
        let owner = "None";
        if (r[i].owner) {
          owner = r[i].owner;
        }
        cell = document.createElement('td');          // Make a cell showing their permissions...
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

    obj.data = JSON.parse(JSON.stringify(data)); // This should make a COPY of data, so deleting its identity won't affect the original.
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
    const type = this.queryObject.nodeLabel;

    const data = {};
    data.name = name;
    data.type = type;
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

// I'm not sure this is ever used.
  getatt(fieldName) {
    let ret = this.fields[fieldName].att
    if (!ret) {
      ret="";
    }
  }

  // I'm almost certain this isn't.
  relationAdd(element) {
    alert(element.previousElementSibling.textContent)
  }

  edit(element){
    const id = element.innerHTML;
    if (this.queryObject.nodeLabel == 'mindmap') {
      new widgetSVG(this.idWidget, id);
    }
    else if (this.queryObject.nodeLabel == "calendar") {
      new widgetCalendar(this.idWidget, id);
    }
    else {
      new widgetNode(this.idWidget, this.queryObject.nodeLabel, id);
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
      new widgetNode(this.idWidget, this.queryObject.nodeLabel, null, name);
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
    const ID = row.children[1].textContent;

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

    // Search for the relation to remove
    const obj = {};
    obj.from = {};
    obj.from.id = ID;
    obj.from.return = false;
    obj.to = {};
    obj.to.type = "LoginTable"; // If this user has a relation to ANY login table, find it (and later, extract login details and delete it)
    obj.to.return = false;
    obj.rel = {};
    obj.rel.type = "Permissions";
    app.nodeFunctions.changeRelation(obj, this, 'checkPermission', ID, button, toAdd);
  }

  checkPermission(data, ID, button, toAdd) {
    if (data.length > 0 && data[0].rel.properties.username && data[0].rel.properties.password) { // If a relation to delete was found
      const obj = {};
      obj.rel = {};
      obj.rel.id = data[0].rel.id;
      obj.rel.return = false;
      app.nodeFunctions.deleteRelation(obj, this, 'givePermission', toAdd, ID, data[0].rel.properties.username, data[0].rel.properties.password);
    }

    else { // If there was no relation to delete, need to ask for a new username and password
      let password;
      const username = prompt("Enter the username:", "");
      if (username) {
        password = prompt("Enter the password:", "");
      }

      // If they entered data, create a link from them to the Admin table
      if (username && password) {
        this.givePermission(null, toAdd, ID, username, password);
      }
    }
  }

  givePermission(button, toAdd, ID, name, password) {
    if (!(toAdd && ID && name && password)) { // if all information needed was NOT passed in
      const row = button.parentElement.parentElement;
      ID = row.children[1].textContent;

      password;
      name = prompt("Enter the username:", "");
      if (name) {
        password = prompt("Enter the password:", "");
      }

      // We should be making a new user, but check the button just in case.
      if (button.value == "Make User") {
        toAdd = "User";
      }
    }

    const obj = {};
    obj.from = {};
    obj.from.id = ID;
    obj.from.return = false;
    obj.to = {};
    obj.to.type = "LoginTable";
    obj.to.properties = {};
    obj.to.properties.name = toAdd;
    obj.to.return = false;
    obj.rel = {};
    obj.rel.type = "Permissions";
    obj.rel.properties = {};
    obj.rel.properties.username = name;
    obj.rel.properties.password = password;
    obj.rel.return = false;
    app.nodeFunctions.createRelation(obj, this, 'search');
  }

  removePermission(button) { // Remove ALL permissions from this user
    const row = button.parentElement.parentElement;
    const ID = row.children[1].textContent;

    const obj = {};
    obj.from = {};
    obj.from.id = ID; // From this user
    obj.from.return = false;
    obj.to = {};
    obj.to.type = "LoginTable"; // To any login table
    obj.to.return = false;
    obj.rel = {};
    obj.rel.type = "Permissions"; // Any permissions link
    obj.rel.return = false;
    app.nodeFunctions.deleteRelation(obj, this, 'search');
  }
} ////////////////////////////////////////////////////// end class widgetTableNodes
