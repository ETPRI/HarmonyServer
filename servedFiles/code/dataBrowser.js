class dataBrowser {
  constructor () {
    this.widgetDOM = null;
    this.widgetID = app.idCounter;
    app.widgets[app.idCounter] = this; // Add to app.widgets
    this.requests = [];

    this.nodeData = {};

    this.leftCell = null;
    this.inCell = null;
    this.mainCell = null;
    this.outCell = null;
    this.rightCell = null;

    this.leftData = null;
    // this.inData = null;
    this.mainData = null;
    // this.outData = null;
    this.rightData = null;

    this.highlightGUIDLeft = null;
    this.typeLeft = null;
    this.highlightGUIDRight = null;
    this.typeRight = null;

    this.relTableRight = null;
    this.relTableLeft = null;
    this.containedWidgets = [];

    this.toToggle = null;

    this.buildWidget();
  }

  buildWidget() {
    let html = app.widgetHeader('dataBrowser');
    html += `<b idr="nodeLabel">Data Browsing Tool</b></span>
              <input type="checkbox" checked idr="leftDataCheck" onclick="app.widget('toggleCell', this, 'leftCell')">Incoming Node&nbsp;&nbsp;&nbsp;&nbsp;
              <input type="checkbox" checked idr="leftRelCheck" onclick="app.widget('toggleCell', this, 'inCell')">Incoming Relations&nbsp;&nbsp;&nbsp;&nbsp;
              <input type="checkbox" checked idr="mainCellCheck" onclick="app.widget('toggleCell', this, 'mainCell')">Main Node&nbsp;&nbsp;&nbsp;&nbsp;
              <input type="checkbox" checked idr="rightDataCheck" onclick="app.widget('toggleCell', this, 'outCell')">Outgoing Relations&nbsp;&nbsp;&nbsp;&nbsp;
              <input type="checkbox" checked idr="rightRelCheck" onclick="app.widget('toggleCell', this, 'rightCell')">Outgoing Node&nbsp;&nbsp;&nbsp;&nbsp;
              <input type="button" class="hidden" idr="cancelButton" value="Cancel" onclick="app.stopProgress(this)">
              </div><table class = 'widgetBody freezable'><tbody><tr>
              <td idr = "leftCell"><p class = "dataBrowserHeader">Incoming Node</p></td>
              <td idr = "inCell"><p class = "dataBrowserHeader">Incoming Relations</p></td>
              <td idr = "mainCell" class = "dataBrowserBlank"
              ondragover="event.preventDefault()" ondrop="app.widget('dropNode', this, event)">
              <p class = "dataBrowserHeader">Main Node</p>
              <p>Drag a node to this cell, or enter the GUID here:
              <input idr="GUIDsearch" onblur="app.widget('GUIDsearch', this)" onkeydown="app.widget('lookForEnter', this, event)"></p>
              </td>
              <td idr = "outCell"><p class = "dataBrowserHeader">Outgoing Relations</p></td>
              <td idr = "rightCell"><p class = "dataBrowserHeader">Outgoing Node</p></td>
            </tr></tbody></table>`;

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
    this.leftCell = app.domFunctions.getChildByIdr(widget, 'leftCell');
    this.inCell = app.domFunctions.getChildByIdr(widget, 'inCell');
    this.mainCell = app.domFunctions.getChildByIdr(widget, 'mainCell');
    this.outCell = app.domFunctions.getChildByIdr(widget, 'outCell');
    this.rightCell = app.domFunctions.getChildByIdr(widget, 'rightCell');

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
        data.sourceType == "dragDrop" && data.sourceTag == "TR" ||
        data.sourceType == "widgetSVG" && data.sourceTag == "B"
      )) {
      return;
    }

    // If we get this far, we should have data about a node, including its GUID.
    this.search(data.nodeID);
  }

  GUIDsearch(input) {
    this.search(input.value);
  }

  lookForEnter(input, evnt) { // Makes hitting enter do the same thing as blurring (inserting a new node or changing an existing one)
    if (evnt.keyCode === 13) {
      input.onblur();
    }
  }

  search(GUID) {
    // Clear all existing data and highlights
    this.leftData = null;
    this.rightData = null;
    this.highlightGUIDLeft = null;
    this.highlightGUIDRight = null;
    this.typeLeft = null;
    this.typeRight = null;

    // check whether the data already exist. If so, use the cached data
    if (this.nodeData[GUID]) {
      this.mainData = this.nodeData[GUID];

      this.refresh();
    }

    else {
      // query the DB for all info about this node and its relations, starting with the incoming relations
      const obj = {};
      obj.required = {"name":"n", "properties":{"M_GUID":GUID}, "return":false};
      obj.optional = {"name":"in"};
      obj.rel = {"name":"inRel", "direction":"left"}; // (required)<-[rel]-(optional)

      app.sendQuery(obj, "findOptionalRelation", "Searching for node", this.widgetDOM, null, null, this.findOuts.bind(this), GUID, "mainData");
    }
  }

  refresh() {
    if (this.toToggle == "left") {
      this.fillCell(this.leftCell, this.leftData, "Left");
      const arrow = app.domFunctions.getChildByIdr(this.inCell, 'leftArrow');
      if (this.leftData === null) {
        arrow.disabled = true;
      }
      else {
        arrow.disabled = false;
      }
    }

    else if (this.toToggle == "right") {
      this.fillCell(this.rightCell, this.rightData, "Right");
      const arrow = app.domFunctions.getChildByIdr(this.outCell, 'rightArrow');
      if (this.rightData === null) {
        arrow.disabled = true;
      }
      else {
        arrow.disabled = false;
      }
    }

    else {
      this.fillCell(this.mainCell, this.mainData, "Main");
      this.fillCell(this.leftCell, this.leftData, "Left");
      this.fillCell(this.rightCell, this.rightData, "Right");
      this.fillRels(this.inCell, this.mainData.ins, this.mainData.inRels, "Incoming");
      this.fillRels(this.outCell, this.mainData.outs, this.mainData.outRels, "Outgoing");
    }
    this.toToggle = null; // reset variable for next time
  }

  fillCell(cell, data, cellName) {
    let startHTML = `<p class = "dataBrowserHeader">${cellName} Node</p>`;
    if (cellName === "Main") {
      startHTML += `<p>Drag a node to this cell, or enter the GUID here:
                      <input idr="GUIDsearch" onblur="app.widget('GUIDsearch', this)" onkeydown="app.widget('lookForEnter', this, event)"></p>`;
    }

    if (data == null) {
      cell.innerHTML = startHTML;
    }
    else {
      let name = "";
      if (data.n.properties.name) {
        name = `: ${data.n.properties.name}`;
      }
      let html = `${startHTML}
                  <p class = "dataBrowserHeader">${data.n.labels[0]}${name}</p><table>`;
      for (let fieldName in data.n.properties) {
        html += `<tr><th>${fieldName}</th><td>${data.n.properties[fieldName]}</td></tr>`
      }
      html += `</table>`;

      cell.innerHTML = html;
    }
  }

  /*
  cell: The DOM element of the cell to fill
  allNodes: The array of all nodes which are connected to the main node in the given direction
  allRels: The array of all relations which are connected to the main node in the given direction
  relName: The name of the type of relation: "Incoming" or "Outgoing"
  */
  fillRels(cell, allNodes, allRels, relName) {
    let relDirection = "To";
    let type = this.typeRight;
    let highlightGUID = this.highlightGUIDRight;
    let tableName = 'relTableRight';
    let arrow = `-&gt;`;
    let direction = "right";

    if (cell.getAttribute('idr') === 'inCell') {
      relDirection = "From";
      type = this.typeLeft;
      highlightGUID = this.highlightGUIDLeft;
      tableName = 'relTableLeft';
      arrow = `&lt;-`;
      direction = "left";
    }

    let working = "";
    if (this[`${direction}Data`] === null) { // leftData enables the left arrow, rightData enables the right arrow
      working = "disabled";
    }

    cell.innerHTML =
    `<p class = "dataBrowserHeader">${relName} Relations</p>
    <input type="button" idr="${direction}Arrow" value="${arrow}" onclick = "app.widget('moveCell', this)" ${working}>
    <div idr="tableDiv${direction}"></div>`;

    let div = app.domFunctions.getChildByIdr(cell,`tableDiv${direction}`);

    let oldIndex = this.containedWidgets.indexOf(app.getProp(this, tableName, "idWidget"));
    if (oldIndex > -1) {
      this.containedWidgets.splice(oldIndex, 1);
    }
    delete this[tableName];

    this.containedWidgets.push(app.idCounter);
    this[tableName] = new widgetTableRelations(allRels, allNodes, div, relDirection, this, type, highlightGUID);
  }

  updateDetails(detailRel) {
    let html = "";
    if (detailRel) {
      let type = detailRel.type;
      html = `<table><tr><th>Type</th><td>${type}</td></tr>`;

      for (let fieldName in detailRel.properties) {
        html += `<tr><th>${fieldName}</th><td>${detailRel.properties[fieldName]}</td></tr>`;
      }

      html += `</table>`;
    }
    return html;
  }

  findOuts(data, GUID, dataName) { // query the DB about outgoing relations, and pass along the incoming ones that were already found
    const obj = {};
    obj.required = {"name":"n", "properties":{"M_GUID":GUID}};
    obj.optional = {"name":"out"};
    obj.rel = {"name":"outRel"};

    app.sendQuery(obj, "findOptionalRelation", "Searching for relations", this.widgetDOM, null, null, this.processData.bind(this), data, dataName);
  }

  processData(outData, inData, dataName) {
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
        inData[i].inRel.properties.nodeGUID = inData[i].in.properties.M_GUID; // store node GUID in relation data
        data.ins.push(inData[i].in);
        data.inRels.push(inData[i].inRel);
      }
    }
    if (outData[0].out) { // If the first outgoing relation is not null (means there IS at least one outgoing relation)
      for (let i = 0; i < outData.length; i++) { // Go through all rows in outData - each row represents one relation to one node
        outData[i].outRel.properties.nodeGUID = outData[i].out.properties.M_GUID; // store node GUID in relation data
        data.outs.push(outData[i].out);
        data.outRels.push(outData[i].outRel);
      }
    }
    // store data for later use
    this.nodeData[data.n.properties.M_GUID] = data;
    this[dataName] = data;
    this.refresh();
  }

  toggleNode(cell) {
    const row = cell.parentElement;
    // bigCell -> div-> table -> tbody -> tr -> td
    let bigCell = cell.parentElement.parentElement.parentElement.parentElement.parentElement;

    // If the cell was already open (we are closing it), clear data.
    // This runs after the row's class is updated - so if the row's class is not "selected", then it should not be selected.
    if (!(row.classList.contains("selectedItem"))) {
      if (bigCell.getAttribute("idr") === "inCell") {
        this.leftData = null;
        this.highlightGUIDLeft = null;
        this.typeLeft = null;
        this.toToggle = "left";
      }
      else if (bigCell.getAttribute("idr") === "outCell") {
        this.rightData = null;
        this.highlightGUIDRight = null;
        this.typeRight = null;
        this.toToggle = "right";
      }
      else {
        app.error ("Trying to close a dataBrowser cell, but the control's great-great-great-grandparent is not inCell or outCell");
      }
      this.refresh();
    }

    // If it was not already open, open it.
    else {
      const relGUID = row.getAttribute('relGUID');
      const rowCount = row.getAttribute('idr').slice(3); // idr is like rowxxx

      const typeDD = app.domFunctions.getChildByIdr(bigCell, "relTypeSelect", true);
      // const typeCell = app.domFunctions.getChildByIdr(row, `TypeCell${rowCount}`);
      const type = typeDD.options[typeDD.selectedIndex].value; // type of the relation

      // determine where to put the new data and which highlight GUID to change
      let nodeName = "";
      let nodeGUID = row.getAttribute('nodeGUID');

      if (bigCell.getAttribute('idr') === "inCell") {
        nodeName = "leftData";
        this.toToggle = "left";
        this.highlightGUIDLeft = relGUID;
        this.typeLeft = type;
      }
      else if (bigCell.getAttribute('idr') === "outCell") {
        nodeName = "rightData";
        this.toToggle = "right";
        this.highlightGUIDRight = relGUID;
        this.typeRight = type;
      }
      else {
        app.error ("Trying to open a dataBrowser cell, but the control's great-great-great-grandparent is not inCell or outCell");
      }

      // check whether the node data already exist
      if (this.nodeData[nodeGUID]) {
        this[nodeName] = this.nodeData[nodeGUID];
        this.refresh();
      }

      else {
        // query the DB for all info about this node and its relations, starting with incoming relations
        const obj = {};
        obj.required = {"name":"n", "properties":{"M_GUID":nodeGUID}, "return":false};
        obj.optional = {"name":"in"};
        obj.rel = {"name":"inRel", "direction":"left"}; // (required)<-[rel]-(optional)

        app.sendQuery(obj, "findOptionalRelation", "Searching for node", this.widgetDOM, null, null, this.findOuts.bind(this), nodeGUID, nodeName);
      }
    }
  }

  moveCell(button) {
    switch(button.getAttribute('idr')) {
      case 'leftArrow': // move to the left - the left cell becomes main, the main cell becomes right
        this.rightData = this.mainData;
        this.mainData = this.leftData;
        this.leftData = null;
        this.highlightGUIDRight = this.highlightGUIDLeft; // The relation that was highlighted on the left is now highlighted on the right
        this.typeRight = this.typeLeft;
        this.highlightGUIDLeft = null;
        this.typeLeft = null;
        break;
      case 'rightArrow': // move to the right - the right cell becomes main, the main cell becomes left
        this.leftData = this.mainData;
        this.mainData = this.rightData;
        this.rightData = null;
        this.highlightGUIDLeft = this.highlightGUIDRight; // The relation that was highlighted on the right is now highlighted on the left
        this.typeLeft = this.typeRight;
        this.highlightGUIDRight = null;
        this.typeRight = null;
        break;
      default:
        app.error("Trying to move through data browser, but the arrow button's IDR is not leftArrow or rightArrow");
        break;
    }
    this.refresh();
  }

  toggleCell(checkBox, name) {
    const cell = app.domFunctions.getChildByIdr(this.widgetDOM, name);
    if (checkBox.checked) {
      cell.classList.remove('hidden');
    }
    else {
      cell.classList.add('hidden');
    }
  }
}
