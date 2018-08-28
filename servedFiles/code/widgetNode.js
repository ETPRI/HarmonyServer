class widgetNode extends widgetDetails {
constructor(callerID, queryObjectName, id, name) {
  super (queryObjectName, null, id, name, callerID);
}

finishConstructor(data) {
  super.finishConstructor(data);
  if (this.id !== null) {
    this.buildStart();
  }
}

buildStart() {
  this.containedWidgets.push(app.idCounter);
  new widgetView(this.startDOM, this.id, "start", this, 'buildEnd');
}

buildEnd() {
  this.containedWidgets.push(app.idCounter);
  new widgetView(this.endDOM, this.id, "end");
}

buildWidget() { // public - build table header
  let id=null;  // assume add mode
  let name = this.name;
  if (name == "") {
    name = `New ${this.nodeLabel} Node`;
  }

  if (this.dataNode) {
    // we are edit mode
    id = this.dataNode.id;
    name = this.dataNode.properties.name;
  }

  app.idCounter--; // decrement ID counter so that the widget header will end up with the right ID
  const html = app.widgetHeader() + `<b idr= "nodeTypeLabel" contentEditable="true"
                                        onfocus="this.parentNode.draggable = false;"
                                        onblur="this.parentNode.draggable = true;">${this.nodeLabel}</b>
                                        <b idr="nodeLabel">#${id}: ${name}</b></div><table class="widgetBody"><tbody><tr>
  <td idr="end"></td>
  <td idr="main">
    <input idr = "addSaveButton" type="button" onclick="app.widget('saveAdd',this)"></div>
    <table idr = "nodeTable"><tbody idr = "nodeTBody"></tbody></table>
  </td>
  <td idr="start"></td>
  </tr></tbody></table>
  </div>
  `
  /*
  Create new element, append to the widgets div in front of existing widgets
  */
  const parent = document.getElementById('widgets');
  const caller = document.getElementById(this.callerID);
  const newWidget = document.createElement('div'); // create placeholder div
  parent.insertBefore(newWidget, caller); // Insert the new div before the widget that opened it
  newWidget.outerHTML = html; // replace placeholder with the div that was just written

  // By this point, the new widget div has been created by buildHeader() and added to the page by the above line
  const widget = document.getElementById(this.idWidget);
  this.widgetDOM  = widget;

  if (app.activeWidget) {
    app.activeWidget.classList.remove("activeWidget");
  }
  app.activeWidget = this.widgetDOM;
  this.widgetDOM.classList.add("activeWidget");

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

  this.addSaveDOM = app.domFunctions.getChildByIdr(widget, "addSaveButton");
  this.tableDOM   = app.domFunctions.getChildByIdr(widget, "nodeTable");
  this.tBodyDOM   = app.domFunctions.getChildByIdr(widget, "nodeTBody");
  this.endDOM     = app.domFunctions.getChildByIdr(widget, "end");
  this.startDOM   = app.domFunctions.getChildByIdr(widget, "start");
}
}
