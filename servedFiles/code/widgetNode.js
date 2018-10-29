class widgetNode extends widgetDetails {
constructor(callerID, queryObjectName, GUID, name) {
  // this.startDOM and this.endDOM are instance variables, but can't be set before super and shouldn't be reset after it
  super (queryObjectName, null, GUID, name, callerID);
  this.requests = [];
}

finishConstructor(data) {
  super.finishConstructor(data);
  if (this.id !== null) {
    this.buildStart();
  }
}

buildWidget() { // public - build table header
  let id=null;  // assume add mode
  let name = this.name;
  if (name == "") {
    name = `New ${this.nodeLabel} Node`;
  }

  if (this.currentData) {
    // we are edit mode
    id = this.currentData.id;
    name = this.currentData.properties.name;
  }

  let addSave = `<input idr = "addSaveButton" type="button" onclick="app.widget('saveAdd',this)">`;
  if (this.queryObjectName.slice(0,2) === 'M_') { // if this is a metadata node
    addSave = "";
  }

  let changeLogHTML = "";
  if (app.login.permissions === "Admin") { // Only admins can see metadata at all, so only they get the show change logs button
    changeLogHTML = `<input type="button" value="Show Change Logs" onclick="app.menuNodes('M_ChangeLog', [{name:'item_GUID', value:'${this.GUID}', dropDownValue:'='}])">`;
  }

  app.idCounter--; // decrement ID counter so that the widget header will end up with the right ID
  const html = app.widgetHeader('widgetNode') + `<b idr= "nodeTypeLabel" contentEditable="true"
    onfocus="this.parentNode.draggable = false;" onblur="this.parentNode.draggable = true;">${this.nodeLabel}</b>
    <b idr="nodeLabel">: ${name}</b></span>
    <input type="button" class="hidden" idr="cancelButton" value="Cancel" onclick="app.stopProgress(this)"></div>
    <table class="widgetBody freezable"><tbody><tr>
  <td idr="end"></td>
  <td idr="main">
    ${addSave}${changeLogHTML}
    <b idr = "dragButton" draggable=true ondragstart="app.widget('drag', this, event)">Drag To View</b>
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
  let caller = document.getElementById(this.callerID);
  const newWidget = document.createElement('div'); // create placeholder div

  // I want to insert the new widget before the TOP-LEVEL widget that called it, if that widget is in the widgets div.
  // The ID passed in is that of the widget that called it, but it may be in another widget. So go up the chain until
  // either caller's parent is the widgets div (meaning that caller is a top-level widget in the widgets div), or caller
  // has no parent (meaning that the original caller was NOT in the widgets div, since no ancestor in that div was found).
  while (caller && caller.parentElement && caller.parentElement !== parent) {
    caller = caller.parentElement;
  }

  if (caller && caller.parentElement && caller.parentElement == parent) { // If the caller is, itself, in the widgets div
    parent.insertBefore(newWidget, caller); // Insert the new div before the caller
  }
  else {
    parent.insertBefore(newWidget, parent.firstElementChild) // Insert the new div at the top of the widgets div
  }

  newWidget.outerHTML = html; // replace placeholder with the div that was just written

  // By this point, the new widget div has been created by buildHeader() and added to the page by the above line
  const widget = document.getElementById(this.idWidget);
  this.widgetDOM  = widget;

  if (app.activeWidget) {
    app.activeWidget.classList.remove("activeWidget");
  }
  app.activeWidget = this.widgetDOM;
  this.widgetDOM.classList.add("activeWidget");

  this.fieldPopup = app.setUpPopup(this);

  // this.fieldPopup = document.createElement("div");
  // this.fieldPopup.setAttribute("hidden", "true");
  // this.fieldPopup.setAttribute('class', 'fieldPopup')
  // this.fieldPopup.innerHTML =
  // `<div class="popupHeader" idr="popupHeader"></div>
  // <div>
  //   <p>Display Name: <input idr="labelInput" type="text"></p>
  //   <p><input idr="showTable" type="checkbox"> Show this field in the table</p>
  //   <p><input idr="showForm" type="checkbox"> Show this field in the detailed form</p>
  //   <p><input type="button" idr="restoreSizeButton" value="Restore textarea to default size"
  //     onclick="app.widget('restoreSize', this)"></p>
  //   <p><input type="button" value="OK" onclick = "app.widget('popupOK', this)">
  //   <input type="button" value="Cancel" onclick="app.widget('popupCancel', this)"></p>
  // </div>
  // `
  // this.fieldPopup.setAttribute("idr", "fieldPopup");
  this.widgetDOM.appendChild(this.fieldPopup);

  this.addSaveDOM = app.domFunctions.getChildByIdr(widget, "addSaveButton");
  this.tableDOM   = app.domFunctions.getChildByIdr(widget, "nodeTable");
  this.tBodyDOM   = app.domFunctions.getChildByIdr(widget, "nodeTBody");
  this.endDOM     = app.domFunctions.getChildByIdr(widget, "end");
  this.startDOM   = app.domFunctions.getChildByIdr(widget, "start");
}

buildStart() {
  this.startDOM.innerHTML = "";
  this.containedWidgets.push(app.idCounter);
  new widgetView(this.startDOM, this.id, "start", this, 'buildEnd');
}

buildEnd() {
  this.endDOM.innerHTML = "";
  this.containedWidgets.push(app.idCounter);
  new widgetView(this.endDOM, this.id, "end");
}
}
