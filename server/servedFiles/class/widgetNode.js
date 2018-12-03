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

    const widgetList = document.getElementById("widgetList"); // Get the list of widgets
    let callerEntry = null;
    if (caller) {
      callerEntry = app.domFunctions.getChildByIdr(widgetList, caller.getAttribute("id"));
    } // Find the entry on that list for the caller, assuming the caller and its entry exist

    const newEntry = document.createElement("li"); // Create an entry for the new widget
    if (callerEntry) { // If the caller's entry exists, the new widget's entry goes above it (like the new widget goes above the caller)
      widgetList.insertBefore(newEntry, callerEntry);
    }
    else { // Otherwise, the new widget's entry goes at the top, like the new widget does
      widgetList.insertBefore(newEntry, widgetList.firstElementChild);
    }

    // Set up the new widget's entry - it should describe the widget for now, and later we'll add listeners
    newEntry.outerHTML =
    `<li idr="${this.idWidget}" onclick="app.clickWidgetEntry(this)" draggable="true"
    ondragstart="app.drag(this, event)" ondragover="event.preventDefault()" ondrop="app.drop(this, event)">
    ${this.nodeLabel} node: <span idr="name">${this.name}</span></li>`;

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

      let downloadHTML = "";
      if (this.numStoredFiles > 0) {
        let versionsHTML = "";
        for (let i = 1; i <= this.numStoredFiles; i++) {
          versionsHTML += `<option `;
          if (i === this.numStoredFiles) {
            versionsHTML += "selected ";
          }
          versionsHTML += `value=${i}>Version ${i}</option>`
        }
        downloadHTML = `<select idr="version">${versionsHTML}</select>
                <input type="button" idr="download" value="Download" onclick="app.widget('downloadFile', this)"`;
      }

      aboveTableHTML =
      `<div class="fileDrop" ondragover="event.preventDefault()" ondrop="event.preventDefault(); app.widget('uploadFile', this, event)">
        Drag a file here, or click the file upload button:
        <input type="file" idr="file" onchange="app.widget('uploadFile', this, event)"><br><br><br><br>
        File uploaded this session: <span idr="uploadedFile">None</span><br>
        Existing versions: <span idr="numStoredFiles">${this.numStoredFiles}</span><br>
        ${downloadHTML}
      </div>`
    }

    const aboveSpan = app.domFunctions.getChildByIdr(this.widgetDOM, "aboveTable");
    aboveSpan.innerHTML = aboveTableHTML;

    let addSave = `<input idr = "addSaveButton" type="button" onclick="app.widget('saveAddMain',this)">`;
    if (this.queryObjectName.slice(0,2) === 'M_') { // if this is a metadata node
      addSave = "";
    }

    let changeLogHTML = "";
    if (app.login.permissions === "Admin") { // Only admins can see metadata at all, so only they get the show change logs button
      changeLogHTML = `<input type="button" value="Show Change Logs" onclick="app.menuNodes('M_ChangeLog', [{name:'item_GUID', value:'${this.GUID}', dropDownValue:'='}])">`;
    }

    const buttons = app.domFunctions.getChildByIdr(this.widgetDOM, "buttons");
    buttons.innerHTML = `${addSave}${changeLogHTML}
                        <input type="button" value="New Data Browser" onclick="new dataBrowser('${this.GUID}')">`;

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

  downloadFile(button) {
    const dropdown = app.domFunctions.getChildByIdr(this.widgetDOM, "version");
    const version = dropdown.options[dropdown.selectedIndex].value;

    const obj = {"fileGUID":this.GUID, "version":version, "type":this.currentData.properties.type[version-1]};
    const queryObject = {"server": "file", "function": "downloadFile", "query": obj};
    const request = JSON.stringify(queryObject);

    const userRequest = app.REST.startUserRequest("Downloading file", this.widgetDOM);
    const serverRequest = app.REST.serverRequests[userRequest]++; // record the current server request and then increment

    const xhttp = new XMLHttpRequest();
    xhttp.responseType = "arraybuffer";
    const update = app.REST.startProgress(this.widgetDOM, "Saving file", request.length, userRequest, serverRequest);
    const details = this;
    const filename = `${this.currentData.properties.name}_v${version}.${this.currentData.properties.type[version-1]}`;

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const responseSize = this.response.byteLength;
        app.REST.stopProgress(details.widgetDOM, update, responseSize, userRequest, serverRequest);

        let dataString = "";
        let dataArray = new Uint8Array(this.response);
        for (let i = 0; i < dataArray.length; i++) {
          dataString += String.fromCharCode(dataArray[i]);
        }
        const encodedData = window.btoa(dataString);

        // copied from a function which took filename and text
        const element = document.createElement('a');
        element.setAttribute('href', `data:application/octet-stream;base64,${encodedData}`);
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
      }
    };

    xhttp.open("POST", "");
    xhttp.send(request);         // send request to server


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
        node.fileBinary = new Uint8Array(evnt.target.result);
      }
      binReader.readAsArrayBuffer(file);

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
