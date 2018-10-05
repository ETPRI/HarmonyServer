class dataBrowser {
  constructor () {
    this.widgetDOM = null;
    this.widgetID = app.idCounter;
    app.widgets[app.idCounter] = this; // Add to app.widgets

    this.nodeData = {};

    this.leftCell = null;
    this.inCell = null;
    this.mainCell = null;
    this.outCell = null;
    this.rightCell = null;

    this.leftData = null;
    this.inData = null;
    this.mainData = null;
    this.outData = null;
    this.rightData = null;

    this.toToggle = null;

    this.buildWidget();
  }

  buildWidget() {
    let html = app.widgetHeader();
    html += `<b idr="nodeLabel">Data Browsing Tool</b></div><table><tbody><tr>
              <td idr = "leftCell"><p class = "dataBrowserHeader">Incoming Node</p></td>
              <td idr = "inCell"><p class = "dataBrowserHeader">Incoming Relations</p></td>
              <td idr = "mainCell" class = "dataBrowserBlank"
              ondragover="event.preventDefault()" ondrop="app.widget('dropNode', this, event)"><p class = "dataBrowserHeader">Main Node</p></td>
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
        data.sourceType == "dragDrop" && data.sourceTag == "TR"
      )) {
      return;
    }

    // If we get this far, we should have data about a node, including its GUID.

    this.leftData = null;
    this.inData = null;
    this.outData = null;
    this.rightData = null;
    this.highlightIDRLeft = null;
    this.highlightIDRRight = null;

    // check whether the data already exist
    if (this.nodeData[data.nodeID]) {
      this.mainData = this.nodeData[data.nodeID];

      this.refresh();
    }

    else {
      // query the DB for all info about this node and its relations, starting with the incoming relations
      const obj = {};
      obj.required = {"name":"n", "properties":{"M_GUID":data.nodeID}};
      obj.optional = {"name":"in"};
      obj.rel = {"name":"inRel", "direction":"left"}; // (required)<-[rel]-(optional)

      const xhttp = new XMLHttpRequest();
      const dataBrowser = this;
      const update = app.startProgress(this.widgetDOM, "Searching for node");

      xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          const newData = JSON.parse(this.responseText);
          app.stopProgress(dataBrowser.widgetDOM, update);
          dataBrowser.findOuts(newData, data.nodeID, "mainData");
        }
      };

      xhttp.open("POST","");
      const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": app.login.userGUID};
      xhttp.send(JSON.stringify(queryObject));         // send request to server
    }
  }

  refresh() {
    if (this.toToggle == "left") {
      this.fillCell(this.leftCell, this.leftData, "Left");
      app.domFunctions.getChildByIdr(this.inCell, 'relDetails').innerHTML = this.updateDetails(this.inData);
    }

    else if (this.toToggle == "right") {
      this.fillCell(this.rightCell, this.rightData, "Right");
      app.domFunctions.getChildByIdr(this.outCell, 'relDetails').innerHTML = this.updateDetails(this.outData);
    }

    else {
      this.fillCell(this.mainCell, this.mainData, "Main");
      this.fillCell(this.leftCell, this.leftData, "Left");
      this.fillCell(this.rightCell, this.rightData, "Right");
      this.fillRels(this.inCell, this.mainData.ins, this.mainData.inRels, this.inData, "Incoming");
      this.fillRels(this.outCell, this.mainData.outs, this.mainData.outRels, this.outData, "Outgoing");
    }
    if (this.highlightIDRLeft !== null) {
      let leftRow = app.domFunctions.getChildByIdr(this.inCell, this.highlightIDRLeft);
      leftRow.setAttribute("class", "dataBrowserOpen");
    }

    if (this.highlightIDRRight !== null) {
      let rightRow = app.domFunctions.getChildByIdr(this.outCell, this.highlightIDRRight);
      rightRow.setAttribute("class", "dataBrowserOpen");
    }
    this.toToggle = null; // reset variable for next time
  }

  fillCell(cell, data, cellName) {
    if (data == null) {
      cell.innerHTML = `<p class = "dataBrowserHeader">${cellName} Node</p>`;
    }
    else {
      let name = "";
      if (data.n.properties.name) {
        name = `: ${data.n.properties.name}`;
      }
      let html = `<p class = "dataBrowserHeader">${cellName} Node</p>
                  <p class = "dataBrowserHeader">${data.n.labels[0]}${name}</p><table>`;
      for (let fieldName in data.n.properties) {
        html += `<tr><th>${fieldName}</th><td>${data.n.properties[fieldName]}</td></tr>`
      }
      html += `</table>`;

      cell.innerHTML = html;
    }
  }

  fillRels(cell, allNodes, allRels, detailRel, relName) { // For now, ignore detailRel - we'll work with it later
    let arrow = "";
    let direction = "";
    if (cell.getAttribute('idr') === "inCell") {
      arrow = `&lt;-`;
      direction = "left";
    }
    else if (cell.getAttribute('idr') === "outCell") {
      arrow = `-&gt;`;
      direction = "right";
    }

    let working = "";
    if (this[`${direction}Data`] === null) { // leftData enables the left arrow, rightData enables the right arrow
      working = "disabled";
    }

    let html = `<p class = "dataBrowserHeader">${relName} Relations</p>
                <input type="button" idr="${direction}Arrow" value="${arrow}" onclick = "app.widget('moveCell', this)" ${working}>
                <div class="relTable"><table><tbody>`;

    for (let i = 0; i < allRels.length; i++) { // for every relation
      let name = allNodes[i].labels[0]; // type first...

      if (allNodes[i].properties.name) { // then name if applicable
        name += `: ${allNodes[i].properties.name}`;
      }

      const arrowHTML =
      `<td class="dataBrowserCell" idr="arrow${allNodes[i].properties.M_GUID}" onclick="app.widget('toggleNode', this)"
           onmouseover="app.widget('showPopup', this)" onmouseout="app.widget('hidePopup', this)">
           ${allRels[i].type}-&gt;${this.buildPopup(allRels[i])}
       </td>`;
       const nameHTML =
       `<td class="dataBrowserCell" idr="name_${allNodes[i].properties.M_GUID}" onclick="app.widget('toggleNode', this)"
            onmouseover="app.widget('showPopup', this)" onmouseout="app.widget('hidePopup', this)">
            ${name}${this.buildPopup(allNodes[i])}
        </td>`;

      if (cell.getAttribute('idr') === "inCell") {
        html += `<tr idr="row_${allRels[i].properties.M_GUID}">${nameHTML}${arrowHTML}</tr>`;
      }
      else if (cell.getAttribute('idr') === "outCell") {
        html += `<tr idr="row_${allRels[i].properties.M_GUID}">${arrowHTML}${nameHTML}</tr>`;
      }
      else {
        app.error("Tried to display relation data in a data browser cell other than inCell or outCell");
      }
    }

    // Finish that div and start the one for the details - it should exist even if it's blank
    html += `</tbody></table></div><div idr = "relDetails">${this.updateDetails(detailRel)}</div>`;

    cell.innerHTML = html;
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

    const xhttp = new XMLHttpRequest();
    const dataBrowser = this;
    const update = app.startProgress(this.widgetDOM, "Searching for relations")

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const newData = JSON.parse(this.responseText);
        app.stopProgress(dataBrowser.widgetDOM, update);
        dataBrowser.processData(newData, data, dataName);
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": app.login.userGUID};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
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
    // store data for later use
    this.nodeData[data.n.properties.M_GUID] = data;
    this[dataName] = data;
    this.refresh();
  }

  toggleNode(cell) {
    // Remove mouseout event, because the cell is about to disappear, which would trigger it unnecessarily
    cell.removeAttribute("onmouseout");

    // If the cell was already open (we are closing it), remove formatting and clear data.
    // bigCell -> div -> table -> tbody -> tr -> td
    let bigCell = cell.parentElement.parentElement.parentElement.parentElement.parentElement;

    if (cell.parentElement.classList.contains("dataBrowserOpen")) {
      if (bigCell.getAttribute("idr") === "inCell") {
        this.inData = null;
        this.leftData = null;
        this.highlightIDRLeft = null;
        this.toToggle = "left";
      }
      else if (bigCell.getAttribute("idr") === "outCell") {
        this.outData = null;
        this.rightData = null;
        this.highlightIDRRight = null;
        this.toToggle = "right";
      }
      else {
        app.error ("Trying to close a dataBrowser cell, but the control's great-great-great-grandparent is not inCell or outCell");
      }
      cell.parentElement.classList.remove("dataBrowserOpen");
      this.refresh();
    }

    // If it was not already open, open it and add formatting.
    else {
      const GUID = cell.getAttribute("idr").slice(5); // The idr will be either arrowxxx or name_xxx, where xxx is the GUID

      // determine where to put the new data and which highlight IDR to change
      let nodeName = "";
      let relIDR = cell.parentElement.getAttribute("idr")
      let relGUID = relIDR.slice(4); // idr is like row_xxx

      if (bigCell.getAttribute('idr') === "inCell") {
        nodeName = "leftData";
        this.highlightIDRLeft = relIDR;
        this.toToggle = "left";

        // relation data should be stored in the main node - just have to find it
        this.inData = this.mainData.inRels.filter(x => x.properties.M_GUID == relGUID)[0];
      }
      else if (bigCell.getAttribute('idr') === "outCell") {
        nodeName = "rightData";
        this.highlightIDRRight = relIDR;
        this.toToggle = "right";

        // relation data should be stored in the main node - just have to find it
        this.outData = this.mainData.outRels.filter(x => x.properties.M_GUID == relGUID)[0];
      }
      else {
        app.error ("Trying to open a dataBrowser cell, but the control's great-great-great-grandparent is not inCell or outCell");
      }


      // check whether the node data already exist
      if (this.nodeData[GUID]) {
        this[nodeName] = this.nodeData[GUID];
        this.refresh();
      }

      else {
        // query the DB for all info about this node and its relations, starting with incoming relations
        const obj = {};
        obj.required = {"name":"n", "properties":{"M_GUID":GUID}};
        obj.optional = {"name":"in"};
        obj.rel = {"name":"inRel", "direction":"left"}; // (required)<-[rel]-(optional)

        const xhttp = new XMLHttpRequest();
        const dataBrowser = this;
        const update = app.startProgress(this.widgetDOM, "Searching for node");

        xhttp.onreadystatechange = function() {
          if (this.readyState == 4 && this.status == 200) {
            const newData = JSON.parse(this.responseText);
            app.stopProgress(dataBrowser.widgetDOM, update);
            dataBrowser.findOuts(newData, GUID, nodeName);
          }
        };

        xhttp.open("POST","");
        const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": app.login.userGUID};
        xhttp.send(JSON.stringify(queryObject));         // send request to server
      }
    }
  }

  buildPopup(data) {
    let type = data.type;
    if (!type) type = data.labels[0];

    let html = `<div class="dataBrowserDescription">
                  <table><tr><th>Type</th><td>${type}</td></tr>`; // start div and table, create first row

    for (let fieldName in data.properties) {
      html += `<tr><th>${fieldName}</th><td>${data.properties[fieldName]}</td></tr>`;
    }

    html += `</table></div>`;
    return ""; // temporarily disabled - change back to return html if I want it to work again
  }

  moveCell(button) {
    switch(button.getAttribute('idr')) {
      case 'leftArrow': // move to the left - the left cell becomes main, the main cell becomes right
        this.rightData = this.mainData;
        this.mainData = this.leftData;
        this.leftData = null;
        this.highlightIDRRight = this.highlightIDRLeft; // The relation that was highlighted on the left is now highlighted on the right
        this.highlightIDRLeft = null;
        this.outData = this.inData; // The incoming relation which was highlighted is now an outgoing relation
        this.inData = null;
        break;
      case 'rightArrow': // move to the right - the right cell becomes main, the main cell becomes left
        this.leftData = this.mainData;
        this.mainData = this.rightData;
        this.rightData = null;
        this.highlightIDRLeft = this.highlightIDRRight; // The relation that was highlighted on the right is now highlighted on the left
        this.highlightIDRRight = null;
        this.inData = this.outData; // The outgoing relation which was highlighted is now an incoming relation
        this.outData = null;

        break;
      default:
        app.error("Trying to move through data browser, but the arrow button's IDR is not leftArrow or rightArrow");
        break;
    }
    this.refresh();
  }

  showPopup(cell) {
    // const popup = cell.firstElementChild;
    // popup.setAttribute("class", "dataBrowserDescShow");
  }

  hidePopup(cell) {
    // const popup = cell.firstElementChild;
    // popup.setAttribute("class", "dataBrowserDescription");
  }
}
