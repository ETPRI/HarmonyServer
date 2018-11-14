// relationDirection = "To" or "From"
class widgetTableRelations {
  constructor (relations, nodes, widgetDOM, relationDirection, parent, relationType, highlightGUID) { // ID of the control that requested this, and list of all relations to display
    this.limitDefault = 10;
    this.widgetDOM = widgetDOM;
    this.parent = parent;
    this.relationDirection = relationDirection;
    this.highlightGUID = highlightGUID;
    this.highlightDOM = null;

    this.idWidget = app.idCounter;   // strings
    app.widgets[app.idCounter++] = this;
    this.widgetDOM.setAttribute('id', this.idWidget);
    this.widgetDOM.classList.add('widget');

    this.fieldPopup = app.setUpPopup(this);

    this.widgetDOM.appendChild(this.fieldPopup);

    if (app.activeWidget) {
      app.activeWidget.classList.remove("activeWidget");
    }
    app.activeWidget = this.widgetDOM;
    this.widgetDOM.classList.add("activeWidget");

    this.relations = relations;
    this.nodes = nodes;
    this.queryObjectName = null; // The type of relation currently being shown

    this.queryObject = null;
    this.relLabel = "All Relations";
    this.fields = null;
    this.fieldsDisplayed = null;
    this.orderBy = null;

    this.data = null; // current data to display
    this.summary = null; // array of objects representing count and name of each type

    this.showNodeName = true;
    this.showNodeType = true;

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
    this.buildHeader();
    this.search(null, relationType); // Initial search - no criteria, uses the relation type passed in if any was
  }

  buildHeader() {
    const header = document.createElement("div");
    this.widgetDOM.appendChild(header);
    header.innerHTML =
    `<input type="button" value="Search" idr="searchButton" onclick="app.widget('search', this)">
    <input type="button" value="Reset" idr="clearButton" onclick="app.widget('reset', this)">
    limit <input idr="limit" style="width: 20px;" onblur="app.regression.logText(this)" onkeydown="app.widget('searchOnEnter', this, event)">
    <span idr="fieldSelectSpan"></span>
    <span idr="relTypeSelectSpan"></span>
    <span idr = "nodeChecks" class="hidden">
      <input type="checkbox" checked idr="nodeNameCheck" onclick="app.widget('toggleColumn', this, 'showNodeName')">Node Name&nbsp;&nbsp;&nbsp;&nbsp;
      <input type="checkbox" checked idr="nodeTypeCheck" onclick="app.widget('toggleColumn', this, 'showNodeType')">Node Type
    </span>`;

    const body = document.createElement("table");
    this.widgetDOM.appendChild(body);
    body.innerHTML =
          `<thead idr = "headerRow">
            <tr idr="headerSearch"></tr>
            <tr idr="header"></tr>
          </thead>
          <tbody idr = "data"> </tbody>`;
  }

  search(button, queryObjectName, criteria) { // public - call when data changes
    const oldQueryObjectName = this.queryObjectName;
    // Start by updating the queryObjectName (what is being searched for) and metadata.
    const dropDown = app.domFunctions.getChildByIdr(this.widgetDOM, 'relTypeSelect');

    if (queryObjectName) {
      this.queryObjectName = queryObjectName;
    }
    else if (dropDown) {
      this.queryObjectName = dropDown.options[dropDown.selectedIndex].value;
    }
    else {
      this.queryObjectName = "All";
    }

    if (this.queryObjectName == "All") {
      this.queryObject = null;
      this.relLabel = "All Relations";
      this.fields = null;
      this.fieldsDisplayed = null;
      this.orderBy = null;
    }
    else {
      this.queryObject = app.metaData.getRelation(this.queryObjectName);
      this.relLabel = this.queryObject.relLabel;
      this.fields = this.queryObject.fields;
      this.fieldsDisplayed = this.queryObject.fieldsDisplayed;
      this.orderBy = this.queryObject.orderBy;
    }

    // Build the summary array if it didn't already exist
    if (!(this.summary)) {
      const dataObj = {};
      this.summary = [];
      for (let i = 0; i < this.relations.length; i++) { // go through all relations and track the number of each type
        const type = this.relations[i].type;
        if (type in dataObj) {
          dataObj[type]++;
        }
        else {
          dataObj[type] = 1;
        }
      } // end for (all relations)

      for (let type in dataObj) {
        this.summary.push({"Type":type, "Count":dataObj[type]});
      }

      this.summary.sort(function(a, b){ // sort by type ascending. There REALLY shouldn't ever be two entries with the same type, but if there are, sorts by count descending.
        if (a.type < b.type) {
          return -1;
        }
        else if (a.type > b.type) {
          return 1;
        }
        else return b.count - a.count;
      });
    } // end if (this.summary didn't already exist)

    // Redraw the fields (and get rid of old search criteria) if the search type has changed
    if (!oldQueryObjectName || oldQueryObjectName !== this.queryObjectName) {
      this.updateFields();
    }

    // Allows the user to pass in an object containing search criteria. Not yet used, but copied in case it comes in handy.
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

    // Ready to start setting this.data to the search results
    if (this.queryObjectName == "All") {
      this.data = JSON.parse(JSON.stringify(this.summary));
    }
    else {
      // Filter out items that aren't the right relation type
      const name = this.queryObjectName
      this.data = this.relations.filter(function(rel){
        return rel.type === name;
      });

      const th  = app.domFunctions.getChildByIdr(this.widgetDOM, "headerRow").firstElementChild.children; // get collection of th

      // Filter out items that don't match search criteria. For every field, check whether search criteria were set.
      // If so, filter using a regex to keep only items matching those criteria.
      // The first four cells are row number, type and in/out node, which are not fields, so skip them in this step.
      let searchParams = {"S":{front:"^", back:""}, "M":{front:"", back:""}, "E":{front:"", back:"$"}, "=":{front:"^", back:"$"}};

      for(let i=4; i<th.length; i++) {
        const inputDOM = th[i].firstElementChild;  // <input>  tag
        // If the text input exists, has a value and has a db attribute (meaning it represents a property field)
        if (inputDOM && inputDOM.tagName == 'INPUT' && 0 < inputDOM.value.length && inputDOM.getAttribute('db')) {
          const dropDown = inputDOM.nextElementSibling;

          // get value of search type and property to search for
          const searchType = dropDown.options[dropDown.selectedIndex].value;
          const db = inputDOM.getAttribute('db');

          switch(searchType) {
            case 'S':
            case 'M':
            case 'E':
              this.data = this.data.filter(function(rel){
                // Should search for the value at the beginning, middle or end of the input and return true if it's found
                if (app.getProp(rel, "properties", db)) {
                  return rel.properties[db].search(new RegExp(`${searchParams[searchType].front}${inputDOM.value}${searchParams[searchType].back}`, 'i')) > -1;
                }
                else return false;
              });
              break;
            case '<':
            case '>':
            case '<=':
            case '>=':
              this.data = this.data.filter(new Function('rel', `
              if (app.getProp(rel, "properties", "${db}")) {
                return rel.properties.${db} ${searchType} ${inputDOM.value};
              }
              else return false;
              `));
              break;
            case '=':
              this.data = this.data.filter(function(rel){
                if (app.getProp(rel, "properties", db)) {
                  return rel.properties[inputDOM.getAttribute('db')] == inputDOM.value;
                }
                else return false;
              });
              break;
          }
        } // end if (input exists, has a value and represents a property field)
      } // end for (all field inputs)

      // Finally, filter based on the name and type of the attached node
      if (th.length > 3) { // If the name and type inputs exist (we aren't going from a summary to a detail view)
        const nodes = this.nodes;

        const nameDOM = th[2].firstElementChild;
        // If the name input exists and has a value
        if (nameDOM && nameDOM.tagName == 'INPUT' && 0 < nameDOM.value.length) {
          const nameDD = nameDOM.nextElementSibling;
          const searchType = nameDD.options[nameDD.selectedIndex].value;

          this.data = this.data.filter(function(rel){
            // Should search for a rel whose NODE's name has the value at the beginning, middle, end or whole value as requested
            if (app.getProp(rel, "properties", "nodeGUID")) { // Assuming the relation stores a node GUID (it should)
              const node = nodes.find(n => n.properties.M_GUID == rel.properties.nodeGUID); // get the corresponding node
              let nodeName = app.getProp(node, "properties", "name"); // the node name, if the node exists and has a name; null otherwise
              return (nodeName && (nodeName.search(new RegExp(`${searchParams[searchType].front}${nameDOM.value}${searchParams[searchType].back}`, 'i')) > -1));
            }
            else return false;
          });
        }

        const typeDOM = th[3].firstElementChild;
        // If the type input exists and has a value
        if (typeDOM && typeDOM.tagName == 'INPUT' && 0 < typeDOM.value.length) {
          const typeDD = typeDOM.nextElementSibling;
          const searchType = typeDD.options[typeDD.selectedIndex].value;

          this.data = this.data.filter(function(rel){
            // Should search for a rel whose NODE's name has the value at the beginning, middle, end or whole value as requested
            if (app.getProp(rel, "properties", "nodeGUID")) { // Assuming the relation stores a node GUID (it should)
              const node = nodes.find(n => n.properties.M_GUID == rel.properties.nodeGUID); // get the corresponding node
              let nodeType = app.getProp(node, "labels", 0); // the node type, if the node exists and has a type; null otherwise
              return (nodeType && (nodeType.search(new RegExp(`${searchParams[searchType].front}${typeDOM.value}${searchParams[searchType].back}`, 'i')) > -1));
            }
            else return false;
          });
        }
      }
      const order = this.orderBy;
      this.data.sort(function(a,b) {
        for (let i = 0; i < order.length; i++) {
          let name = order[i].name;
          let dir = order[i].direction;
          if (a.name < b.name || (b.name < a.name && dir == "D")) {
            return -1; // Return -1 if a goes before b (because it's less, or it's greater and we're sorting descending)
          }
          else if (a.name > b.name || (b.name > a.name && dir == "D"))
          {
            return 1; // Return 1 if a goes after b (because it's greater, or it's less and we're sorting descending)
          }
        } // If a and b are the same on this attribute, move on to the next attribute in this.orderBy.

        // If there are no more attributes to look at, and we still haven't returned 1 or -1,
        // then these items are identical (at least in all attributes we want to sort on), so return 0.
        return 0;
      });
    } // end else (search type is not "All")

    // Truncate the result to the length set by limit
    const limit = parseInt(app.domFunctions.getChildByIdr(this.widgetDOM, "limit").value);
    if (!(isNaN(limit)) && limit > 0 && this.data.length > limit) { // if the limit is a positive number, truncate the data to fit it
      this.data.length = limit;
    }

    // After setting this.data, refresh the widget - both headers and data if the type has changed; just data if not
    this.buildData();
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

    const dropdowns = widget.getElementsByTagName('select');
    for (let i = 0; i < dropdowns.length; i++) {
      dropdowns[i].selectedIndex = 0;
    }
  }

  refresh() {
    this.updateFields();
    this.buildData();
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
	  obj.from = {"id":app.login.userID, "return":false};
	  obj.rel = {"type":"Settings", "merge":true, "return":false};
	  obj.to = {"type":"M_MetaData", "properties":{"name":this.queryObjectName}, "return":false};
	  obj.changes = [{"item":"rel", "property":"fieldsDisplayed", "value":app.stringEscape(JSON.stringify(this.fieldsDisplayed))}];

    userRequest = app.REST.startUserRequest("Updating displayed fields", this.widgetDOM);

    app.REST.sendQuery(obj, "changeRelation", "Updating metadata", userRequest, this.widgetDOM);

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
    let dirSearchHTML = '';
    let dirNameHTML = '';
    let typeSearchHTML = '';
    let typeNameHTML = '';
    let checkSpan = app.domFunctions.getChildByIdr(this.widgetDOM, 'nodeChecks');
    if (this.queryObjectName !== 'All') {
      buttonHTML = `<input type="button" value="Field Select" onclick="app.widget('fieldSelect', this)">`;
      if (this.showNodeName) {
        dirSearchHTML +=
         `<th>
            <input idr = "textNodeName" size="7" onblur="app.regression.logText(this)"
            onkeydown="app.widget('searchOnEnter', this, event)" value="">
            ${strSearch.replace('#x#', 'nodeName')}
          </th>`;
          dirNameHTML += `<th>${this.relationDirection}: Name</th>`;
      }
      if (this.showNodeType) {
        dirSearchHTML += `
        <th>
          <input idr = "textNodeType" size="7" onblur="app.regression.logText(this)"
          onkeydown="app.widget('searchOnEnter', this, event)" value="">
          ${strSearch.replace('#x#', 'nodeType')}
        </th>`;
        dirNameHTML += `<th>${this.relationDirection}: Type</th>`;
      }
      // dirSearchHTML =
      // `<th>
      //   <input idr = "textNodeName" size="7" onblur="app.regression.logText(this)"
      //   onkeydown="app.widget('searchOnEnter', this, event)" value="">
      //   ${strSearch.replace('#x#', 'nodeName')}
      // </th>
      // <th>
      //   <input idr = "textNodeType" size="7" onblur="app.regression.logText(this)"
      //   onkeydown="app.widget('searchOnEnter', this, event)" value="">
      //   ${strSearch.replace('#x#', 'nodeType')}
      // </th>`;

      // dirNameHTML = `<th>${this.relationDirection}: Name</th><th>${this.relationDirection}: Type</th>`;

      checkSpan.classList.remove('hidden');
    }
    else {
      typeSearchHTML = '<th></th>';
      typeNameHTML = "<th>Type</th>";
      checkSpan.classList.add('hidden');
    }

    let span = app.domFunctions.getChildByIdr(this.widgetDOM, 'fieldSelectSpan');
    span.innerHTML = buttonHTML;

    let dropdownHTML = `<select idr="relTypeSelect"><option value="All">All (summary)</option>`;
    for (let i = 0; i < this.summary.length; i++) {
      let selected = '';
      if (this.summary[i].Type === this.queryObjectName) {
        selected = ' selected';
      }
      dropdownHTML += `<option${selected} value="${this.summary[i].Type}">${this.summary[i].Type}</option>`;
    }
    dropdownHTML += `</select>`;

    let dropDownSpan = app.domFunctions.getChildByIdr(this.widgetDOM, 'relTypeSelectSpan');
    dropDownSpan.innerHTML = dropdownHTML;

    let headerSearch = app.domFunctions.getChildByIdr(this.widgetDOM, 'headerSearch');
    let searchCells = Array.from(headerSearch.children);

    //Order: row number, type (if summary), to/from node (if not summary), count or specific fields

    // build search part of buildHeader.
    let s=`<th></th>${typeSearchHTML}${dirSearchHTML}`;
    if (this.queryObjectName === 'All') {
      s += `<th></th>`; // No search function for count
    }
    else {
      for (let i=0; i<this.fieldsDisplayed.length; i++ ) {
        const fieldName =this.fieldsDisplayed[i];
        let s1 = `<th db="${fieldName}" idr="searchCell${fieldName}" ondragstart="app.widget('dragHeader', this, event)"
                  ondragover="event.preventDefault()" ondrop="app.widget('dropHeader', this, event)" draggable="true">
                    <input idr = "text${i}" db="#1" size="7" onblur="app.regression.logText(this)"
                    onkeydown="app.widget('searchOnEnter', this, event)">`;
        if (this.fields && this.fields[fieldName] && this.fields[fieldName].type === "number") {
          // number search
          s1 += numSearch.replace('#x#', i);
        } else {
          // assume string search
          s1 += strSearch.replace('#x#', i);
        }
        s += s1.replace('#1',fieldName);
      }
    }

    headerSearch.innerHTML = s;

    //Order: row number, type (if summary), direction (if not summary), count or specific fields

    // build field name part of header
    let f=`<th>#</th>${typeNameHTML}${dirNameHTML}`;
    if (this.queryObjectName === "All") {
      f += `<th>Count</th>`;
    }
    else {
      for (let i=0; i<this.fieldsDisplayed.length; i++ ) {
          const fieldName =this.fieldsDisplayed[i];
          f += `<th db="${fieldName}" oncontextmenu= "event.preventDefault(); app.widget('showPopup', this)" draggable="true"
          ondragstart="app.widget('dragHeader', this, event)" ondragover="event.preventDefault()" ondrop="app.widget('dropHeader', this, event)">
          ${this.fields[fieldName].label}</th>`;
      }
    }

    let header = app.domFunctions.getChildByIdr(this.widgetDOM, 'header');
    header.innerHTML = f;
  }

  buildData() {  // build dynamic part of table
    let html = "";
    const r = this.data; // array of all relations to be displayed
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
      row.setAttribute('idr', `row${rowCount}`);

      //Order: row number, type (if summary), direction (if not summary), count or specific fields

      // Create a cell for rowCount and append it
      cell = document.createElement('td');
      row.appendChild(cell);
      cell.setAttribute('idr', `rowCount${rowCount}`);
      cell.textContent = rowCount;

      if (this.queryObjectName === "All") { // For a summary table, just show the rowcount, type and count.
        // clicking the ID number shows that type of relation
        cell.setAttribute("onclick", "app.widget('showType', this)");

        // Create a new cell for the type...
        cell = document.createElement('td');
        row.appendChild(cell);
        cell.textContent = r[i].Type;
        cell.setAttribute('idr', `TypeCell${rowCount++}`);

        // and the count
        cell = document.createElement('td');
        row.appendChild(cell);
        cell.textContent = r[i].Count;
      }

      else {
        row.setAttribute('nodeGUID', r[i].properties.nodeGUID);
        row.setAttribute('relGUID', r[i].properties.M_GUID);

        // Clicking the row ID number shows/hides the relation
        cell.setAttribute("onclick", "app.widget('showRel', this)");

        // this.highlightGUID is passed in at the start to determine which row should start off selected
        if (r[i].properties.M_GUID === this.highlightGUID) {
          row.classList.add("selectedItem");
          this.highlightDOM = row;
        }

        // Now add cells for "to" or "from" if needed
        const node = this.nodes.find(n => n.properties.M_GUID == r[i].properties.nodeGUID);

        if (this.showNodeName) {
          cell = document.createElement('td');
          row.appendChild(cell);
          cell.outerHTML = `<td>${app.getProp(node, "properties", "name")}</td>`;
        }

        if (this.showNodeType) {
          cell = document.createElement('td');
          row.appendChild(cell);
          cell.outerHTML = `<td>${app.getProp(node, "labels", 0)}</td>`;
        }

        // For each display field, create a cell and append it
        for (let j=0; j<this.fieldsDisplayed.length; j++) {
          cell = document.createElement('td');
          const fieldName = this.fieldsDisplayed[j];
          text = document.createTextNode(r[i].properties[fieldName]);
          cell.appendChild(text);
          row.appendChild(cell);
        }
      }

      // Append the whole row to the data table
      table.appendChild(row);
    } // end for (every row in this.data)
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
    	  obj.from = {"id":app.login.userID, "return":false};
    	  obj.rel = {"type":"Settings", "merge":true, "return":false};
    	  obj.to = {"type":"M_MetaData", "properties":{"name":this.queryObjectName}, "return":false};
    	  obj.changes = [{"item":"rel", "property":"fieldsDisplayed", "value":app.stringEscape(JSON.stringify(this.fieldsDisplayed))}];

        const userRequest = app.REST.startUserRequest("Rearranging fields", this.widgetDOM);

        app.REST.sendQuery(obj, "changeRelation", "Updating metadata", userRequest, this.widgetDOM);
        this.refresh();
      }
    }
  }

  showType(cell) {
    const row = cell.parentElement;
    const rowCount = row.getAttribute('idr').slice(3); // idr is like rowxxx
    const typeCell = app.domFunctions.getChildByIdr(row, `TypeCell${rowCount}`);
    const type = typeCell.textContent;
    this.search(null, type);
  }

  showRel(cell) {
    const row = cell.parentElement;
    if (this.highlightDOM == row) { // if this row was already highlighted
      row.classList.remove('selectedItem'); // remove highlighting
      this.highlightDOM = null;
      this.highlightGUID = null;
    }

    else {
      if (this.highlightDOM) { // if some other row was already highlighted
        this.highlightDOM.classList.remove('selectedItem'); // remove highlighting
      }
      this.highlightDOM = row; // add highlighting to this row
      this.highlightGUID = row.getAttribute("relGUID");
      row.classList.add('selectedItem');
    }

    this.parent.toggleNode(cell); // calls toggleNode in the parent, so the parent can decide how to show the relation
  }

  toggleColumn(checkBox, name) {
    if (checkBox.checked) {
      this[name] = true;
    }
    else {
      this[name] = false;
    }
    this.refresh();
  }
} ////////////////////////////////////////////////////// end class widgetTableNodes
