class widgetNode extends widgetDetails {
  constructor(callerID, queryObjectName, GUID, name) {
    // Create a placeholder widget, just so there's something to show progress as the node loads
      const html = app.widgetHeader('widgetNode') + `<b idr= "nodeTypeLabel" contentEditable="true"
      onfocus="this.parentNode.parentNode.draggable = false;" onblur="this.parentNode.parentNode.draggable = true;"><span idr="nodeLabel"></span></b>
      <b idr="name"></b></span>
      <span idr="aboveTable"></span>
      <input type="button" class="hidden" idr="cancelButton" value="Cancel" onclick="app.stopProgress(this)"></div>
      <table class="widgetBody freezable"><tbody><tr>
        <td idr="end"></td>
        <td idr="main">
          <span idr="buttons"></span>
          <b idr = "dragButton" draggable=true ondragstart="app.widget('drag', this, event)">Drag To View</b>
          <table idr = "nodeTable"><tbody idr = "nodeTBody"></tbody></table>
        </td>
        <td idr="start"></td>
      </tr></tbody></table>
    </div>`

    app.idCounter--; // decrement ID counter so that the widget header will end up with the right ID

    const parent = document.getElementById('widgets');
    let caller = document.getElementById(callerID);
    let newWidget = document.createElement('div'); // create placeholder div

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
      parent.insertBefore(newWidget, parent.firstElementChild); // Insert the new div at the top of the widgets div
    }

    newWidget.outerHTML = html; // replace placeholder with the div that was just written
    newWidget = document.getElementById(app.idCounter); // Reset newWidget, since changing outerHTML "erases" the old div

    // this.startDOM and this.endDOM are instance variables, but can't be set before super and shouldn't be reset after it
    super (queryObjectName, newWidget, GUID, name, callerID);
    this.requests = [];
  }

  finishConstructor(data, userRequest) {
    super.finishConstructor(data, userRequest);
    if (this.id !== null) {
      this.buildStart(userRequest);
    }
  }

  buildWidget() { // public - build table header
    const labelSpan = app.domFunctions.getChildByIdr(this.widgetDOM, 'nodeLabel');
    labelSpan.textContent = this.nodeLabel;

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

    const nameSpan = app.domFunctions.getChildByIdr(this.widgetDOM, "name");
    nameSpan.innerHTML = `: ${name}`;

    let aboveTableHTML = "";
    if (this.queryObjectName === "file") {
      this.numStoredFiles = app.getProp(this, "currentData", "properties", "type", "length");
      if (!(this.numStoredFiles)) {
        this.numStoredFiles = 0;
      }
      aboveTableHTML =
      `<div class="fileDrop" ondrop="app.widget('uploadFile', this, event)">
        Drag a file here, or click the file upload button:
        <input type="file" idr="file" onchange="app.widget('uploadFile', this, event)"><br><br><br><br>
        File uploaded this session: <span idr="uploadedFile">None</span><br>
        Existing versions: <span idr="numStoredFiles">${this.numStoredFiles}</span><br>
      </div>`

      // if (app.getProp(this, "currentData", "type")) {
      //   // The type array shows the types of all stored files, so its length is the number of stored files
      //   this.numStoredFiles = this.currentData.type.length;
      // }
    }

    const aboveSpan = app.domFunctions.getChildByIdr(this.widgetDOM, "aboveTable");
    aboveSpan.innerHTML = aboveTableHTML;

    let addSave = `<input idr = "addSaveButton" type="button" onclick="app.widget('saveAdd',this)">`;
    if (this.queryObjectName.slice(0,2) === 'M_') { // if this is a metadata node
      addSave = "";
    }

    let changeLogHTML = "";
    if (app.login.permissions === "Admin") { // Only admins can see metadata at all, so only they get the show change logs button
      changeLogHTML = `<input type="button" value="Show Change Logs" onclick="app.menuNodes('M_ChangeLog', [{name:'item_GUID', value:'${this.GUID}', dropDownValue:'='}])">`;
    }

    const buttons = app.domFunctions.getChildByIdr(this.widgetDOM, "buttons");
    buttons.innerHTML = `${addSave}${changeLogHTML}`;

    // app.idCounter--; // decrement ID counter so that the widget header will end up with the right ID
    // const html = app.widgetHeader('widgetNode') + `<b idr= "nodeTypeLabel" contentEditable="true"
    //   onfocus="this.parentNode.parentNode.draggable = false;" onblur="this.parentNode.parentNode.draggable = true;">${this.nodeLabel}</b>
    //   <b idr="nodeLabel">: ${name}</b></span>
    //   ${aboveTableHTML}
    //   <input type="button" class="hidden" idr="cancelButton" value="Cancel" onclick="app.stopProgress(this)"></div>
    //   <table class="widgetBody freezable"><tbody><tr>
    //     <td idr="end"></td>
    //     <td idr="main">
    //       ${addSave}${changeLogHTML}
    //       <b idr = "dragButton" draggable=true ondragstart="app.widget('drag', this, event)">Drag To View</b>
    //       <table idr = "nodeTable"><tbody idr = "nodeTBody"></tbody></table>
    //     </td>
    //     <td idr="start"></td>
    //   </tr></tbody></table>
    // </div>
    // `
    // /*
    // Create new element, append to the widgets div in front of existing widgets
    // */
    //
    //
    // const parent = document.getElementById('widgets');
    // let caller = document.getElementById(this.callerID);
    // const newWidget = document.createElement('div'); // create placeholder div
    //
    // // I want to insert the new widget before the TOP-LEVEL widget that called it, if that widget is in the widgets div.
    // // The ID passed in is that of the widget that called it, but it may be in another widget. So go up the chain until
    // // either caller's parent is the widgets div (meaning that caller is a top-level widget in the widgets div), or caller
    // // has no parent (meaning that the original caller was NOT in the widgets div, since no ancestor in that div was found).
    // while (caller && caller.parentElement && caller.parentElement !== parent) {
    //   caller = caller.parentElement;
    // }
    //
    // if (caller && caller.parentElement && caller.parentElement == parent) { // If the caller is, itself, in the widgets div
    //   parent.insertBefore(newWidget, caller); // Insert the new div before the caller
    // }
    // else {
    //   parent.insertBefore(newWidget, parent.firstElementChild); // Insert the new div at the top of the widgets div
    // }
    //
    // newWidget.outerHTML = html; // replace placeholder with the div that was just written

    // By this point, the new widget div has been created by buildHeader() and added to the page by the above line
    // const widget = document.getElementById(this.idWidget);
    // this.widgetDOM  = widget;

    if (app.activeWidget) {
      app.activeWidget.classList.remove("activeWidget");
    }
    app.activeWidget = this.widgetDOM;
    this.widgetDOM.classList.add("activeWidget");

    this.fieldPopup = app.setUpPopup(this);

    this.widgetDOM.appendChild(this.fieldPopup);

    this.addSaveDOM = app.domFunctions.getChildByIdr(this.widgetDOM, "addSaveButton");
    this.tableDOM   = app.domFunctions.getChildByIdr(this.widgetDOM, "nodeTable");
    this.tBodyDOM   = app.domFunctions.getChildByIdr(this.widgetDOM, "nodeTBody");
    this.endDOM     = app.domFunctions.getChildByIdr(this.widgetDOM, "end");
    this.startDOM   = app.domFunctions.getChildByIdr(this.widgetDOM, "start");
  }

  buildStart(userRequest) {
    this.startDOM.innerHTML = "";
    this.containedWidgets.push(app.idCounter);
    new widgetView(this.startDOM, this.id, "start", userRequest, this, 'buildEnd', userRequest);
  }

  buildEnd(userRequest) {
    this.endDOM.innerHTML = "";
    this.containedWidgets.push(app.idCounter);
    new widgetView(this.endDOM, this.id, "end", userRequest);
  }

  uploadFile(input, evnt) {
    evnt.preventDefault();
    // Get file
    let file = null;
    if (input.tagName === "INPUT") { // If this was triggered by the file upload button
      file = app.getProp(input, "files", 0);
    }
    else {
      file = app.getProp(evnt, "dataTransfer", "files", 0);
    }

    if (file) { // If the user uploaded a file
      this.file = file;
      const node = this;

      const textReader = new FileReader();
      textReader.onload = function(evnt) {
        node.fileText = evnt.target.result;
      }
      textReader.readAsText(file);

      const binReader = new FileReader();
      binReader.onload = function(evnt) {
        node.fileBinary = evnt.target.result;
      }
      binReader.readAsBinaryString(file);

      // Update dragdrop area
      const span = app.domFunctions.getChildByIdr(this.widgetDOM, 'uploadedFile');
      span.innerHTML = file.name;

      // Update current data
      let props = app.getProp(this, "currentData", "properties");
      if (props) {
        if (!(props.name)) { // If the node didn't have a name, use the file name
          props.name = file.name.split('.')[0];
        }
        if (!props.type) { // If the node didn't have a "type" variable, make it an array starting with this file's type
          props.type = [file.name.split('.')[1]];
        }
        // Otherwise, make the latest entry the file's type
        // (use this.numStoredFiles rather than push to overwrite any non-saved file that was already there)
        else {
          props.type[this.numStoredFiles] = file.name.split('.')[1];
        }
      }

      else {
        this.currentData = {"properties":{"name":file.name, "type":[file.type]}};
      }

      // Call refresh
      this.refresh();
    }
  }
}
