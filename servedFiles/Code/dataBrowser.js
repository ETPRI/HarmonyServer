class dataBrowser {
  constructor () {
    this.widgetDOM   = {};
    this.widgetID = app.idCounter;
    app.widgets[app.idCounter] = this; // Add to app.widgets

    this.db = new db();
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
    // If the object being dragged is not a node
    if (!data || data.sourceType != "widgetTableNodes" || data.sourceTag != "TD") {
      return;
    }

    // If we get this far, we should have data about a node, including its ID.

    // check whether the data already exist
    if (this.nodeData[data.nodeID]) {
      this.loadNode(this.nodeData[data.nodeID], cell);
    }

    else {
      // query the DB for all info about this node and its relations

      // DBREPLACE DB function: changePattern
      // JSON object: {nodesFind:[{name:"n"; ID:data.nodeID};
      //                          {name:"in"};
      //                          {name:"out"}];
      //              relsFind:[{name:"inRel"; from: "in"; to: "n"; optional:true};
      //                        {name:"outRel"; from: "n"; to: "out"; optional:true}]}
      // This still wouldn't do the collecting, but we could take the raw data and do collecting in the program

      const query = `match (n) where ID(n) = ${data.nodeID}
      with n optional match (in)-[inRel]->(n)
      with n, collect(in) as ins, collect(inRel) as inRels optional match (out)<-[outRel]-(n)
      return n, inRels, ins, collect(outRel) as outRels, collect(out) as outs`;
      this.db.setQuery(query);
      this.db.runQuery(this, 'loadNode', cell);
    }
  }

  loadNode(data, cell) {
    // store data for later use
    this.nodeData[data[0].n.identity] = data;

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
    for (let fieldName in data[0].n.properties) {
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
      const valueText = document.createTextNode(data[0].n.properties[fieldName]);
      dataField.appendChild(valueText);
    }
    // Create next cell and populate
    const relCell = document.createElement("td");
    cell.parentElement.appendChild(relCell);

    const relTable = document.createElement("table");
    relCell.appendChild(relTable);
    const ins = data[0].ins;
    const inRels = data[0].inRels;
    const outs = data[0].outs;
    const outRels = data[0].outRels;

    for (let i = 0; i < ins.length; i++) { // for every incoming relation
      const row = document.createElement("tr");
      relTable.appendChild(row);

      const arrowCell = document.createElement("td");
      arrowCell.setAttribute("class", "dataBrowserCell");

      const arrowText = document.createTextNode("<-");
      arrowCell.appendChild(arrowText);
      row.appendChild(arrowCell);

      const inDescription = this.createArrowPopup(inRels[i]);
      arrowCell.appendChild(inDescription);
      arrowCell.setAttribute("onmouseover", "app.widget('showPopup', this)");
      arrowCell.setAttribute("onmouseout", "app.widget('hidePopup', this)");
      arrowCell.setAttribute("onclick", "app.widget('toggleNode', this)");
      arrowCell.setAttribute("idr", `arrow${ins[i].identity}`);

      const nameCell = document.createElement("td");
      nameCell.setAttribute("class", "dataBrowserCell");
      let name = ins[i].properties.name; // Display the node's name if it exists, or else its type
      if (!name) {
        name = ins[i].labels[0];
      }
      const nameText = document.createTextNode(name);
      nameCell.appendChild(nameText);
      row.appendChild(nameCell);

      const nodeDesc = this.createNodePopup(ins[i]);
      nameCell.appendChild(nodeDesc);
      nameCell.setAttribute("onmouseover", "app.widget('showPopup', this)");
      nameCell.setAttribute("onmouseout", "app.widget('hidePopup', this)");
      nameCell.setAttribute("onclick", "app.widget('toggleNode', this)");
      nameCell.setAttribute("idr", `name_${ins[i].identity}`);
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

      const nodeDesc = this.createNodePopup(outs[i]);
      nameCell.appendChild(nodeDesc);
      nameCell.setAttribute("onmouseover", "app.widget('showPopup', this)");
      nameCell.setAttribute("onmouseout", "app.widget('hidePopup', this)");
      nameCell.setAttribute("onclick", "app.widget('toggleNode', this)");
      nameCell.setAttribute("idr", `name_${outs[i].identity}`);

      const arrowCell = document.createElement("td");
      arrowCell.setAttribute("class", "dataBrowserCell");
      const arrowText = document.createTextNode("->");
      arrowCell.appendChild(arrowText);
      row.appendChild(arrowCell);

      const outDescription = this.createArrowPopup(outRels[i]);
      arrowCell.appendChild(outDescription);
      arrowCell.setAttribute("onmouseover", "app.widget('showPopup', this)");
      arrowCell.setAttribute("onmouseout", "app.widget('hidePopup', this)");
      arrowCell.setAttribute("onclick", "app.widget('toggleNode', this)");
      arrowCell.setAttribute("idr", `arrow${outs[i].identity}`);
    }

    cell.setAttribute("class", "dataBrowser");
  }

  createNodePopup(node) {
    const description = document.createElement("div");
    description.setAttribute("class", "dataBrowserDescription");
    const relDescTable = document.createElement("table");
    description.appendChild(relDescTable);
    const typeRow = document.createElement("tr");
    relDescTable.appendChild(typeRow);
    const typeLabelCell = document.createElement("th");
    typeRow.appendChild(typeLabelCell);
    const typeLabel = document.createTextNode("Type");
    typeLabelCell.appendChild(typeLabel);
    const typeCell = document.createElement("td");
    typeRow.appendChild(typeCell);
    const type = document.createTextNode(node.labels[0]);
    typeCell.appendChild(type);

    for (let fieldName in node.properties) {
      const fieldRow = document.createElement("tr");
      relDescTable.appendChild(fieldRow);
      const fieldLabelCell = document.createElement("th");
      fieldRow.appendChild(fieldLabelCell);
      const fieldLabel = document.createTextNode(fieldName);
      fieldLabelCell.appendChild(fieldLabel);
      const fieldValueCell = document.createElement("tr");
      fieldRow.appendChild(fieldValueCell);
      const fieldValue = document.createTextNode(node.properties[fieldName]);
      fieldValueCell.appendChild(fieldValue);
    }
    return description;
  }

  createArrowPopup(rel) {
    const description = document.createElement("div");
    description.setAttribute("class", "dataBrowserDescription");
    const relDescTable = document.createElement("table");
    description.appendChild(relDescTable);
    const typeRow = document.createElement("tr");
    relDescTable.appendChild(typeRow);
    const typeLabelCell = document.createElement("th");
    typeRow.appendChild(typeLabelCell);
    const typeLabel = document.createTextNode("Type");
    typeLabelCell.appendChild(typeLabel);
    const typeCell = document.createElement("td");
    typeRow.appendChild(typeCell);
    const type = document.createTextNode(rel.type);
    typeCell.appendChild(type);

    for (let fieldName in rel.properties) {
      const fieldRow = document.createElement("tr");
      relDescTable.appendChild(fieldRow);
      const fieldLabelCell = document.createElement("th");
      fieldRow.appendChild(fieldLabelCell);
      const fieldLabel = document.createTextNode(fieldName);
      fieldLabelCell.appendChild(fieldLabel);
      const fieldValueCell = document.createElement("tr");
      fieldRow.appendChild(fieldValueCell);
      const fieldValue = document.createTextNode(rel.properties[fieldName]);
      fieldValueCell.appendChild(fieldValue);
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

      const ID = cell.getAttribute("idr").slice(5); // The idr will be either arrowxxx or name_xxx

      // Create new cell for new node details
      const newCell = document.createElement("td");
      mainRow.appendChild(newCell);

      // check whether the data already exist
      if (this.nodeData[ID]) {
        this.loadNode(this.nodeData[ID], newCell);
      }

      else {
        // query the DB for all info about this node and its relations
        // DBREPLACE DB function: changePattern
        // JSON object: {nodesFind:[{name:"n"; ID:data.nodeID};
        //                          {name:"in"};
        //                          {name:"out"}];
        //              relsFind:[{name:"inRel"; from: "in"; to: "n"; optional:true};
        //                        {name:"outRel"; from: "n"; to: "out"; optional:true}]}
        // This still wouldn't do the collecting, but we could take the raw data and do collecting in the program
        const query = `match (n) where ID(n) = ${ID}
        with n optional match (in)-[inRel]->(n)
        with n, collect(in) as ins, collect(inRel) as inRels optional match (out)<-[outRel]-(n)
        return n, inRels, ins, collect(outRel) as outRels, collect(out) as outs`;
        this.db.setQuery(query);
        this.db.runQuery(this, 'loadNode', newCell);
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
