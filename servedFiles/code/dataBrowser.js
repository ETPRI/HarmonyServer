class dataBrowser {
  constructor () {
    this.widgetDOM   = {};
    this.widgetID = app.idCounter;
    app.widgets[app.idCounter] = this; // Add to app.widgets

    this.nodeData = {};

    this.buildWidget();
  }

  buildWidget() {
    let html = app.widgetHeader();
    html += `<b idr="nodeLabel">Data Browsing Tool</b></div><table><tbody><tr>
              <td idr = "startingNode" class = "dataBrowserBlank"
              ondragover="event.preventDefault()" ondrop="app.widget('dropNode', this, event)">
            </td></tr></tbody></table>`;

    /*
    Create new element, append to the widgets div in front of existing widgets
    */
    const parent = document.getElementById('widgets');
    const child = parent.firstElementChild;
    const newWidget = document.createElement('div'); // create placeholder div
    parent.insertBefore(newWidget, child); // Insert the new div before the widget that opened it
    newWidget.outerHTML = html; // replace placeholder with the div that was just written

    // By this point, the new widget div has been created by buildHeader() and added to the page by the above line
    const widget = document.getElementById(this.widgetID);
    this.widgetDOM = widget;

    if (app.activeWidget) {
      app.activeWidget.classList.remove("activeWidget");
    }
    app.activeWidget = this.widgetDOM;
    this.widgetDOM.classList.add("activeWidget");
  }

  dropNode(cell, evnt) {
    let data = null;
    const dataText = evnt.dataTransfer.getData("text/plain");
    if (dataText) {
      data = JSON.parse(dataText);
    }
    // If the object being dragged is not a node (from a widgetTableNodes, widgetRelations, widgetNode or dragDrop)
    if (!data || !(
        data.sourceType == "widgetTableNodes" && data.sourceTag == "TD" ||
        data.sourceType == "widgetRelations" && data.sourceTag == "TR" ||
        data.sourceType == "widgetNode" && data.sourceTag == "B" ||
        data.sourceType == "dragDrop" && data.sourceTag == "TR"
      )) {
      return;
    }

    // If we get this far, we should have data about a node, including its GUID.

    // check whether the data already exist
    if (this.nodeData[data.nodeID]) {
      this.loadNode(this.nodeData[data.nodeID], cell);
    }

    else {
      // query the DB for all info about this node and its relations, starting with the incoming relations
      const obj = {};
      obj.required = {"name":"n", "properties":{"M_GUID":data.nodeID}};
      obj.optional = {"name":"in"};
      obj.rel = {"name":"inRel", "direction":"left"}; // (required)<-[rel]-(optional)

      const xhttp = new XMLHttpRequest();
      const dataBrowser = this;

      xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          const newData = JSON.parse(this.responseText);
          dataBrowser.findOuts(newData, data.nodeID, cell);
        }
      };

      xhttp.open("POST","");
      const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": app.login.userGUID};
      xhttp.send(JSON.stringify(queryObject));         // send request to server
    }
  }

  findOuts(data, GUID, cell) { // query the DB about outgoing relations, and pass along the incoming ones that were already found
    const obj = {};
    obj.required = {"name":"n", "properties":{"M_GUID":GUID}};
    obj.optional = {"name":"out"};
    obj.rel = {"name":"outRel"};

    const xhttp = new XMLHttpRequest();
    const dataBrowser = this;

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const newData = JSON.parse(this.responseText);
        dataBrowser.processData(newData, data, cell);
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": app.login.userGUID};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
  }

  processData(outData, inData, cell) {
    const data = {};
    // There will always be at least one entry in inData and one in outData
    // (even if there are no relations, there will be an entry with n and "null" for everything else).
    // ANY entry should have the same, valid information for n, so it doesn't matter which we use.
    data.n = outData[0].n;
    data.ins = [];
    data.inRels = [];
    data.outs = [];
    data.outRels = [];
    if (inData[0].in) { // If the first incoming relation is not null (means there IS at least one incoming relation)
      for (let i = 0; i < inData.length; i++) { // Go through all rows in inData - each row represents one relation to one node
        data.ins.push(inData[i].in);
        data.inRels.push(inData[i].inRel);
      }
    }
    if (outData[0].out) { // If the first outgoing relation is not null (means there IS at least one outgoing relation)
      for (let i = 0; i < outData.length; i++) { // Go through all rows in outData - each row represents one relation to one node
        data.outs.push(outData[i].out);
        data.outRels.push(outData[i].outRel);
      }
    }
    this.loadNode(data, cell);
  }

  loadNode(data, cell) {
    // store data for later use
    this.nodeData[data.n.properties.M_GUID] = data;

    // Make sure cell is blank
    while (cell.firstElementChild) {
      cell.removeChild(cell.firstElementChild);
    }

    // Remove cells to the right
    while (cell.nextElementSibling) {
      cell.parentElement.removeChild(cell.nextElementSibling);
    }

    // Create table in cell
    const detailTable = document.createElement("table");
    cell.appendChild(detailTable);

    // Populate table
    for (let fieldName in data.n.properties) {
      // Create a table row
      const row = document.createElement('tr');
      detailTable.appendChild(row); // Edit this

      // Create the first cell, a th cell containing the label as text
      const header = document.createElement('th');
      row.appendChild(header);
      const labelText = document.createTextNode(fieldName);
      header.appendChild(labelText);

      const dataField = document.createElement('td');
      row.appendChild(dataField);
      const valueText = document.createTextNode(data.n.properties[fieldName]);
      dataField.appendChild(valueText);
    }
    // Create next cell and populate
    const relCell = document.createElement("td");
    cell.parentElement.appendChild(relCell);

    const relTable = document.createElement("table");
    relCell.appendChild(relTable);
    const ins = data.ins;
    const inRels = data.inRels;
    const outs = data.outs;
    const outRels = data.outRels;

    for (let i = 0; i < ins.length; i++) { // for every incoming relation
      const row = document.createElement("tr");
      relTable.appendChild(row);

      const arrowCell = document.createElement("td");
      arrowCell.setAttribute("class", "dataBrowserCell");

      const arrowText = document.createTextNode("<-");
      arrowCell.appendChild(arrowText);
      row.appendChild(arrowCell);

      const inDescription = this.buildPopup(inRels[i]);
      arrowCell.appendChild(inDescription);
      arrowCell.setAttribute("onmouseover", "app.widget('showPopup', this)");
      arrowCell.setAttribute("onmouseout", "app.widget('hidePopup', this)");
      arrowCell.setAttribute("onclick", "app.widget('toggleNode', this)");
      arrowCell.setAttribute("idr", `arrow${ins[i].properties.M_GUID}`);

      const nameCell = document.createElement("td");
      nameCell.setAttribute("class", "dataBrowserCell");
      let name = ins[i].properties.name; // Display the node's name if it exists, or else its type
      if (!name) {
        name = ins[i].labels[0];
      }
      const nameText = document.createTextNode(name);
      nameCell.appendChild(nameText);
      row.appendChild(nameCell);

      const nodeDesc = this.buildPopup(ins[i]);
      nameCell.appendChild(nodeDesc);
      nameCell.setAttribute("onmouseover", "app.widget('showPopup', this)");
      nameCell.setAttribute("onmouseout", "app.widget('hidePopup', this)");
      nameCell.setAttribute("onclick", "app.widget('toggleNode', this)");
      nameCell.setAttribute("idr", `name_${ins[i].properties.M_GUID}`);
    }

    for (let i = 0; i < outs.length; i++) { // for every outgoing relation
      const row = document.createElement("tr");
      relTable.appendChild(row);

      const nameCell = document.createElement("td");
      nameCell.setAttribute("class", "dataBrowserCell");
      let name = outs[i].properties.name; // Display the node's name if it exists, or else its type
      if (!name) {
        name = outs[i].labels[0];
      }
      const nameText = document.createTextNode(name);
      nameCell.appendChild(nameText);
      row.appendChild(nameCell);

      const nodeDesc = this.buildPopup(outs[i]);
      nameCell.appendChild(nodeDesc);
      nameCell.setAttribute("onmouseover", "app.widget('showPopup', this)");
      nameCell.setAttribute("onmouseout", "app.widget('hidePopup', this)");
      nameCell.setAttribute("onclick", "app.widget('toggleNode', this)");
      nameCell.setAttribute("idr", `name_${outs[i].properties.M_GUID}`);

      const arrowCell = document.createElement("td");
      arrowCell.setAttribute("class", "dataBrowserCell");
      const arrowText = document.createTextNode("->");
      arrowCell.appendChild(arrowText);
      row.appendChild(arrowCell);

      const outDescription = this.buildPopup(outRels[i]);
      arrowCell.appendChild(outDescription);
      arrowCell.setAttribute("onmouseover", "app.widget('showPopup', this)");
      arrowCell.setAttribute("onmouseout", "app.widget('hidePopup', this)");
      arrowCell.setAttribute("onclick", "app.widget('toggleNode', this)");
      arrowCell.setAttribute("idr", `arrow${outs[i].properties.M_GUID}`);
    }

    cell.setAttribute("class", "dataBrowser");
  }

  buildPopup(data) {
    const description = document.createElement("div");
    description.setAttribute("class", "dataBrowserDescription");
    const relDescTable = document.createElement("table");

    let type = data.type;
    if (!type) type = data.labels[0];

    relDescTable.innerHTML = `<tr><th>Type</th><td>${type}</td></tr>`;
    description.appendChild(relDescTable);

    for (let fieldName in data.properties) {
      relDescTable.innerHTML += `<tr><th>${fieldName}</th><td>${data.properties[fieldName]}</td></tr>`;
    }
    return description;
  }

  toggleNode(cell) {
    // If there are cells to the right of this column, remove them
    // big row->big cell->little table->little row->little cell
    const bigCell = cell.parentElement.parentElement.parentElement;
    const mainRow = bigCell.parentElement;

    while (bigCell.nextElementSibling) {
      mainRow.removeChild(bigCell.nextElementSibling);
    }

    // Now, if the cell was already open (we are closing it), just remove formatting.
    if (cell.parentElement.classList.contains("dataBrowserOpen")) {
      cell.parentElement.classList.remove("dataBrowserOpen");
    }

    // If it was not already open, open it and add formatting.
    else {
      // Go through the row's siblings and make sure none of them has the dataBrowserOpen class
      const siblings = cell.parentElement.parentElement.children;
      for (let i = 0; i < siblings.length; i++) {
        siblings[i].classList.remove("dataBrowserOpen");
      }

      // mark this cell's row as active, and ensure that clicking it again will close it
      cell.parentElement.setAttribute("class", "dataBrowserOpen");

      const GUID = cell.getAttribute("idr").slice(5); // The idr will be either arrowxxx or name_xxx, where xxx is the GUID

      // Create new cell for new node details
      const newCell = document.createElement("td");
      mainRow.appendChild(newCell);

      // check whether the data already exist
      if (this.nodeData[GUID]) {
        this.loadNode(this.nodeData[GUID], newCell);
      }

      else {
        // query the DB for all info about this node and its relations, starting with incoming relations
        const obj = {};
        obj.required = {"name":"n", "properties":{"M_GUID":GUID}};
        obj.optional = {"name":"in"};
        obj.rel = {"name":"inRel", "direction":"left"}; // (required)<-[rel]-(optional)

        const xhttp = new XMLHttpRequest();
        const dataBrowser = this;

        xhttp.onreadystatechange = function() {
          if (this.readyState == 4 && this.status == 200) {
            const newData = JSON.parse(this.responseText);
            dataBrowser.findOuts(newData, GUID, newCell);
          }
        };

        xhttp.open("POST","");
        const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": app.login.userGUID};
        xhttp.send(JSON.stringify(queryObject));         // send request to server
      }
    }
  }

  showPopup(cell) {
    const popup = cell.firstElementChild;
    popup.setAttribute("class", "dataBrowserDescShow");
  }

  hidePopup(cell) {
    const popup = cell.firstElementChild;
    popup.setAttribute("class", "dataBrowserDescription");
  }
}
