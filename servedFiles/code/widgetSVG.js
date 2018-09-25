class widgetSVG {
  constructor (callerID, GUID, name) { // create variables, query for data if needed, then call buildWidget()
    this.widgetID = app.idCounter;
    this.mapGUID = GUID;
    this.mapID = null;
    this.SVG_DOM = null;
    this.widgetDOM = null;
    this.name = name;
    app.widgets[app.idCounter] = this;
    this.containedWidgets = [];
    this.callerID = callerID;
    this.owner = null;

    this.d3Functions  = null;
    this.clicks       = null;
    this.keys         = null;
    this.detailsPane  = null;
    this.details      = null;

    this.nodeLabel = app.metaData.getNode('mindmap').nodeLabel;

    // constants for drawing
    this.width = 1200; // Width of the SVG element
    this.height = 600; // Height of the SVG element

    // variables for dragging map and selecting nodes
    this.currentX=0;
    this.currentY=0;
    this.selectedNodes = new Set();
    this.selectBox = null;
    this.selectBoxCorner = [0,0];

    // used for editing notes
    this.notesText = null;
    this.notesLabel = null;

    if (this.mapGUID) {
      const obj = {};
      obj.required = {"name":"mindmap", "type":"mindmap", "properties":{"M_GUID":this.mapGUID}};

      const xhttp = new XMLHttpRequest();
      const SVG = this;
      const update = app.startProgress("Opening mindmap");

      xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(this.responseText);
          app.stopProgress(update);
          SVG.buildWidget(data);
        }
      };

      xhttp.open("POST","");
      const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": app.login.userGUID};
      xhttp.send(JSON.stringify(queryObject));         // send request to server
    }

    else {
      this.buildWidget();
    }
  } // end constructor

  buildWidget(data) { // create blank mind map, then if data was passed in, call loadComplete
    if (!this.name) {
      this.name = "Untitled mind map";  // The name starts off untitled; it can change later
    }

    const html = app.widgetHeader() +
      `<b idr="name" contenteditable="true"
                     onfocus="this.parentNode.draggable = false;"
                     onblur="this.parentNode.draggable = true;">${this.name}</b>
      <input type="button" idr="save" value="Save" onclick="app.widget('startSave', this)">
      <input type="button" idr="saveAs" value="Save As" onclick="app.widget('startSave', this)">
      <input type="button" idr="details" value="Show Details" onclick="app.widget('toggleWidgetDetails', this)">
    </div>
    <div class = "widgetBody"><table><tr idr="svgRow"><td>
      <svg id="svg${this.widgetID}" width="${this.width}" height="${this.height}" viewBox = "0 0 ${this.width} ${this.height}"
        ondblclick="app.widget('newBox', this, event)"
        ondragover="app.widget('allowDrop', this, event)"
        ondrop="app.widget('dropAdd', this, event)"
        oncontextmenu="event.preventDefault()"
        onmousedown="app.widget('dragStart', this, event)"
    </svg></td>
    <td id = "detailsPane" class="hidden">
      <b idr= "nodeTypeLabel" contentEditable="true">${this.nodeLabel}</b>
      <b idr="nodeLabel">#${this.mapID}: ${this.name}</b>
    </td></tr></table></div></div>`;

    const parent = document.getElementById('widgets');
    const caller = document.getElementById(this.callerID);
    const newWidget = document.createElement('div'); // create placeholder div

    if (caller.parentElement == parent) { // If the caller is, itself, in the widgets div
      parent.insertBefore(newWidget, caller); // Insert the new div before the caller
    }
    else {
      parent.insertBefore(newWidget, parent.firstElementChild) // Insert the new div at the top of the widgets div
    }

    newWidget.outerHTML = html; // replace placeholder with the div that was just written
    this.SVG_DOM = document.getElementById(`svg${this.widgetID}`);
    this.widgetDOM = document.getElementById(`${this.widgetID}`);

    this.notesText = document.createElement("textarea");
    this.notesText.setAttribute("hidden", "true");
    this.notesText.setAttribute("idr", "notes");
    this.notesText.setAttribute("oncontextmenu", "event.preventDefault()");
    this.SVG_DOM.appendChild(this.notesText);

    d3.select(`#svg${this.widgetID}`).append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", 0)
      .attr("idr", "selectBox")
      .attr("class", "selectBox hidden");
    this.selectBox = app.domFunctions.getChildByIdr(this.SVG_DOM, "selectBox");

    this.d3Functions = new d3Functions(this);
    this.clicks = new mindmapClick(this, this.SVG_DOM, this.d3Functions);
    this.keys = new mindmapKeypress(this.d3Functions, this.newChild.bind(this), this.newSibling.bind(this), this); // Navigation is likely to be standard, but effects of tab and enter may change

    this.detailsPane = document.getElementById('detailsPane');
    this.containedWidgets.push(app.idCounter);
    this.details = new widgetDetails('mindmap', this.detailsPane, this.mapGUID);

    if (data) {
      this.loadComplete(data);
    }

    if (app.activeWidget) {
      app.activeWidget.classList.remove("activeWidget");
    }
    app.activeWidget = this.widgetDOM;
    this.widgetDOM.classList.add("activeWidget");
  } // end buildWidget

  loadComplete(data) { // Sets the roots array for the mind map to match the data that was loaded, then calls update() to draw the mind map
    if (data.length == 0) {
      alert ("Error: Mind map not found");
    }
    else { // If a result was returned - which should always happen
      this.mapID = data[0].mindmap.id;
      if (data[0].mindmap.properties.M_roots) {
        this.d3Functions.roots = JSON.parse(data[0].mindmap.properties.M_roots);

        // Go through all objects, make them reference d3Functions, add to objects array
        let nonRootObjs = [];
        for (let i = 0; i < this.d3Functions.roots.length; i++) { // for every root...
          const root = this.d3Functions.roots[i];
          // Make a deep copy and store in d3Functions' savedObjects array
          this.d3Functions.savedObjects[root.id] = JSON.parse(JSON.stringify(root));

          root.instance = this.d3Functions;
          for (let j = 0; j < root.details.length; j++) {
            root.details[j].instance = this.d3Functions;
          }

          if (root.children) {
            nonRootObjs = nonRootObjs.concat(root.children);
          }
          else if (root._children) {
            nonRootObjs = nonRootObjs.concat(root._children);
          }
          this.d3Functions.objects[root.id] = {};
          this.d3Functions.objects[root.id].JSobj = root; // Store JS object
          this.d3Functions.objects[root.id].DOMelements = {}; // Prepare to store DOM elements
        }

        while (nonRootObjs.length > 0) { // If there are more objects...
          const label = nonRootObjs.pop();
          // Make a deep copy and store in d3Functions' savedObjects array
          this.d3Functions.savedObjects[label.id] = JSON.parse(JSON.stringify(label));

          label.instance = this.d3Functions;
          for (let j = 0; j < label.details.length; j++) {
            label.details[j].instance = this.d3Functions;
          }

          if (label.children) {
            nonRootObjs = nonRootObjs.concat(label.children);
          }
          else if (label._children) {
            nonRootObjs = nonRootObjs.concat(label._children);
          }

          this.d3Functions.objects[label.id] = {};
          this.d3Functions.objects[label.id].JSobj = label; // Store JS object
          this.d3Functions.objects[label.id].DOMelements = {}; // Prepare to store DOM elements
        }
      }

      if (data[0].mindmap.properties.M_count) {
        this.d3Functions.count = data[0].mindmap.properties.M_count;
      }
      if (data[0].mindmap.properties.name) {
        this.name = data[0].mindmap.properties.name;
        const nameText = app.domFunctions.getChildByIdr(this.widgetDOM, 'name');
        nameText.textContent = this.name;
        const detailsName = app.domFunctions.getChildByIdr(this.widgetDOM, 'nodeLabel', true);
        detailsName.textContent = `${this.mapID}: ${this.name}`;
      }

      /*
      Data will be multiple lines; each will include a node connected to the mindmap and a relation
      (unless there ARE no such nodes, in which case data will be only one line and its "rel" and "optional" entries will be null)
      For every line, check the type of relation. It should be "Owner", "ViewPermission" or "MapNode".
      If it's "MapNode", then the link should say which label the node goes with. Fill in that label with that node's information.
      Also, in savedObjects, create a new property "inDB" and set it to true for that label.
      If it's "Owner", create a new variable this.owner and store some information (say, the name and ID) for the owner.
      Ignore "Permissions" for now.
      */
      if (data[0].rel != null) {
        for (let i = 0; i < data.length; i++) {
          const type = data[i].rel.type;
          switch (type) {
            case "MapNode":
              const labelID = data[i].rel.properties.id;
              const node = data[i].optional;
              const nodeType = node.labels[0];
              const labelObj = this.d3Functions.objects[labelID].JSobj;
              labelObj.name = node.properties.name;
              labelObj.nodeID = node.properties.M_GUID;
              labelObj.type = nodeType;

              labelObj.details = [];
              const fields = app.metaData.node[nodeType].fieldsDisplayed;
              if (fields) {
                for (let j = 0; j < fields.length; j++) {
                  const field = fields[j];
                  if (field != "name") {
                    const newRow = {};
                    newRow.field = field;
                    newRow.value = node.properties[field];
                    newRow.instance = this.d3Functions;
                    labelObj.details.push(newRow);
                  }
                }
              }

              const savedCopy = this.d3Functions.savedObjects[labelID];
              savedCopy.inDB = true;
              break;
            case "Owner":
              this.owner = {};
              this.owner.name = data[i].optional.properties.name;
              this.owner.id = data[i].optional.id;
              if (this.owner.id != app.login.userID) { // If the map belongs to someone else, disable saving
                const saveButton = app.domFunctions.getChildByIdr(document.getElementById(this.widgetID), 'save');
                saveButton.style.display='none';
              }
              break;
            case "Permissions":
              break;
            default:
              app.error("This mindmap has a relationship of an unrecognized type.");
          }
        }
      }

      this.d3Functions.update();
    }
  }

  toggleWidgetDetails(button) {
    if (button.value == "Show Details") {
      this.detailsPane.classList.remove("hidden");
      button.value = "Hide Details";
    }
    else {
      this.detailsPane.classList.add("hidden");
      button.value = "Show Details";
    }
  }

  allowDrop(object, evnt) { // Prevent default action so drag and drop works properly. Also find parent and sibling nodes.
    evnt.preventDefault();
    const mouseLocation = {};
    mouseLocation.left = evnt.clientX;
    mouseLocation.right = evnt.clientX;
    mouseLocation.top = evnt.clientY;
    mouseLocation.bottom = evnt.clientY;
    this.clicks.highlightParent(mouseLocation, null);
  }

  dropAdd (svg, evnt) { // Add node to the list of root nodes in the mind map and call update.
    let data = {};
    if (evnt.dataTransfer.getData("text/uri-list")) { // If the object being dragged is a link
      data.name = evnt.dataTransfer.getData("text/uri-list");
      data.nodeID = null;
      data.type = "link";
      const uri = {};
      uri.field = "uri";
      uri.value = evnt.dataTransfer.getData("text/uri-list");
      data.details = [];
      data.details.push(uri);
    }

    else if (evnt.dataTransfer.files.length > 0) {
      const test = evnt.dataTransfer.items[0].getAsFile();
      data.name = evnt.dataTransfer.files[0].name;
      data.nodeID = null;
      data.type = "file";
      const type = {};
      type.field = "filetype";
      type.value = evnt.dataTransfer.files[0].type;
      data.details = [];
      data.details.push(type);
    }

    else { // If it's not a link, check whether it's a node...
      const dataText = evnt.dataTransfer.getData("text/plain");
      if (dataText) {
        data = JSON.parse(dataText);
      }
      // If the object being dragged is not a node (it has no data, or didn't come from either a TD in a table or a button in a form)
      if (!data ||
          !(data.sourceType == "widgetTableNodes" && data.sourceTag == "TD" ||
            data.sourceType == "widgetNode" && data.sourceTag == "B") ) {
        return;
      }
    }

    const name = data.name;

    const x = evnt.clientX;
    const y = evnt.clientY;
    const bound = svg.getBoundingClientRect();
    const top = bound.top;
    const left = bound.left;
    const viewBox = svg.getAttribute("viewBox").split(" ");
    const relX = x - left + parseInt(viewBox[0]);
    const relY = y - top + parseInt(viewBox[1]);

    let group = null;
    //  Check whether user dropped ONTO an existing label.
    // If so, instead of adding the new node as a new label, call connectNode to connect it to that existing label.
    const rects = this.clicks.checkClickedNode(null, x, y);
    if (rects) {
      for (let i = 0; i < rects.length; i++) {
        if (rects[i].classList.contains("nodeRect") && !(rects[i].classList.contains("deletedData"))) {
          group = rects[i].parentElement;
        }
      }
    }
    if (group) { // If there is some group such that the data was dropped onto its main rectangle
      // Don't make a new object - just add "instance" to each details row and pass data to connectNode
      for (let i = 0; i < data.details.length; i++) {
        data.details[i].instance = this.d3Functions;
      }
      this.connectNode(group, data);
    }

    else { // If we didn't drop onto an existing label, we're making a new one, so call newObj.
      const newObj = this.d3Functions.newObj();
      newObj.x = relX;
      newObj.y = relY;
      newObj.nodeID = data.nodeID;
      newObj.name = name;
      newObj.type = data.type;
      newObj.DBType = data.DBType;
      newObj.details = data.details;
      this.d3Functions.editNode = null; // NOTE: Fix this; we shouldn't be assigning a variable just to unassign it later

      // Trying to get reference to this object into the data, where anonymous functions can use it
      newObj.instance = this.d3Functions;
      for (let i = 0; i < newObj.details.length; i++) {
        newObj.details[i].instance = this.d3Functions;
      }

      // now check if user dropped NEAR a label. This can be determined by checking parentNode in clicks.
      // If so, add the new node as a child of that label, then reset clicks variables.
      if (this.clicks.parentNode) {
        this.clicks.dropConnect(this.clicks.parentNode, newObj);
        // Remove parent node and formatting
        this.clicks.parentNode.classList.remove("parent");
        this.clicks.parentNode = null;
        this.clicks.nextSibling = null;
        this.clicks.prevSibling = null;
      }

      // If it wasn't dropped on or near a label, add it as a root.
      else {
        this.d3Functions.roots.push(newObj);
      }
    } // end else (didn't drop onto an existing label)
    this.d3Functions.update();

    // Make this the active widget
    if (app.activeWidget) {
      app.activeWidget.classList.remove("activeWidget");
    }
    app.activeWidget = this.widgetDOM;
    this.widgetDOM.classList.add("activeWidget");
  }

  connectNode(group, newObj) { // Connect a node to a label
    const id = group.getAttribute("idr").slice(5);
    const labelObj = this.d3Functions.objects[id].JSobj;

    labelObj.name = newObj.name;
    labelObj.nodeID = newObj.nodeID;
    labelObj.type = newObj.type;
    labelObj.DBType = newObj.DBType;
    labelObj.details = newObj.details;
    this.makeSelectedNode(group);
  }

  newBox(element, evnt) {
    // Get positioning information
    const x = evnt.clientX;
    const y = evnt.clientY;
    const bound = this.SVG_DOM.getBoundingClientRect();
    const top = bound.top;
    const left = bound.left;
    const viewBox = this.SVG_DOM.getAttribute("viewBox").split(" ");
    const relX = x - left + parseInt(viewBox[0]);
    const relY = y - top + parseInt(viewBox[1]);

    // verify that the user doubleclicked on an EMPTY spot
    const elements = this.clicks.checkClickedNode(null, x, y);
    if (elements == null) {
      const newObj = this.d3Functions.newObj();
      newObj.x = relX;
      newObj.y = relY;
      this.d3Functions.roots.push(newObj);
      this.d3Functions.update();
    }
  }

  newChild() {
    if (this.selectedNodes.size == 1) {
      for (let node of this.selectedNodes) {
        const labelID = node.getAttribute("idr").slice(5); // the IDR will be like groupxxx, and the xxx will be the ID assigned by the SVG to this label
        const nodeObj = this.d3Functions.objects[labelID].JSobj; // Get the object representing this node

        if (nodeObj._children && nodeObj._children.length > 0) { // If the object has children, but they are hidden, show them.
          const button = this.d3Functions.objects[labelID].DOMelements.toggle;
          this.toggleChildren(button);
          // The children, if any, should now be visible, and the object should have a children array.
        }

        const child = this.d3Functions.newObj(); // Create a new blank label object...
        child.parent = labelID;
        nodeObj.children.push(child); // make it a new child of the selected node...
      }
      this.d3Functions.update(); // and redraw the graphic.
    }
  }

  // If NOT currently editing a node (in which case, hitting Enter just means "Done editing"),
  // or its notes (in which case, hitting Enter just starts a new line),
  // create a new younger sibling for the node.
  newSibling() {
    if (this.selectedNodes.size == 1 && this.notesText.hidden == true) {
      for (let node of this.selectedNodes) {
        const labelID = node.getAttribute("idr").slice(5); // the IDR will be like groupxxx, and the xxx will be the ID assigned by the SVG to this label
        const nodeObj = this.d3Functions.objects[labelID].JSobj; // Get the object representing this node
        const parentID = nodeObj.parent;
        if (parentID != "null") { // If the selected node has a parent, it can have siblings
        const parent = this.d3Functions.objects[parentID].JSobj;
          const child = this.d3Functions.newObj();

          const index = parent.children.indexOf(nodeObj) + 1; // Insert in the NEXT position, to come after the previous sibling
          parent.children.splice(index, 0, child);
          child.parent = parentID;
        }
      }
      this.d3Functions.update();
    }
  }

  keyPressed(evnt) {
    this.keys.keyPressed(evnt);
  }

  click(rectangle, evnt, methodName) {
    this.clicks[methodName](rectangle, evnt);
  }

  dragStart(SVG, evnt) {
    // Verify empty spot
    const elements = this.clicks.checkClickedNode(null, evnt.clientX, evnt.clientY);
    if (elements == null) {
      this.currentX = evnt.clientX; // get mouse position
      this.currentY = evnt.clientY;
      // Now check whether the shift key is down - If it is, we're selecting multiple nodes.
      if (!(evnt.shiftKey)) {
        // Deselect all selected nodes
        if (this.selectedNodes.size > 0) {
          for (let node of this.selectedNodes) {
            const id = node.getAttribute("idr").slice(5); // groupxxx
            this.hideEverything(id);
            node.classList.remove("selected");
          }
          this.selectedNodes.clear();
        }

        SVG.setAttribute("onmousemove", "app.widget('drag', this, event)");
        SVG.setAttribute("onmouseup", "this.removeAttribute('onmousemove'); this.removeAttribute('onmouseup')");
      }
      else { // if the shift key is down
        const x = evnt.clientX;
        const y = evnt.clientY;
        const bound = SVG.getBoundingClientRect();
        const top = bound.top;
        const left = bound.left;
        const viewBox = SVG.getAttribute("viewBox").split(" ");
        const relX = x - left + parseInt(viewBox[0]);
        const relY = y - top + parseInt(viewBox[1]);

        // make select box visible (well, except for its size) and position it
        SVG.appendChild(this.selectBox);
        this.selectBox.classList.remove("hidden");
        this.selectBox.setAttribute("x", relX);
        this.selectBox.setAttribute("y", relY);
        this.selectBox.setAttribute("width", 0);
        this.selectBox.setAttribute("height", 0);
        this.selectBoxCorner[0] = relX;
        this.selectBoxCorner[1] = relY;

        // set mousemove and mouseup listeners
        SVG.setAttribute("onmousemove", "app.widget('dragSelect', this, event)");
        SVG.setAttribute("onmouseup", "app.widget('stopDragSelect', this, event)");
      }
    }

    // If at least one rectangle was clicked in, check each clicked rectangle for a mousedownObj.
    // If the shift key was held, check for a shiftClickObj instead.
    else {
      for (let i = 0; i < elements.length; i++) {
        let obj = null;

        if (evnt.shiftKey) {
          obj = JSON.parse(elements[i].getAttribute("shiftClickObj"));
        }
        else {
          obj = JSON.parse(elements[i].getAttribute("mousedownObj"));
        }

        if (obj) { // If this rectangle has a mousedown object...
          if (obj.subclass) {
            this[obj.subclass][obj.method](elements[i], evnt, obj.args);
          }
          else {
            this[obj.method](elements[i], evnt, obj.args);
          }
          // If at least one rectangle was clicked in, and had a mousedown event
          // (so we're doing something other than scrolling),
          // check for mouseup events when the mouse is released.
          SVG.setAttribute("onmouseup", "app.widget('mouseup', this, event)");
        }
      }
    }
  }

  drag(SVG, evnt) {
    const dx = evnt.clientX - this.currentX;
    const dy = evnt.clientY - this.currentY;
    this.currentX = evnt.clientX;
    this.currentY = evnt.clientY;
    let viewBox = SVG.getAttribute("viewBox").split(" ");
    viewBox[0] = parseInt(viewBox[0]) - dx;
    viewBox[1] = parseInt(viewBox[1]) - dy;
    SVG.setAttribute("viewBox", `${viewBox[0]} ${viewBox[1]} ${this.width} ${this.height}`)
  }

  mouseup(SVG, evnt) {
    const elements = this.clicks.checkClickedNode(null, evnt.clientX, evnt.clientY);
    if (elements) { // If at least one rectangle was clicked in, check each clicked rectangle for a mouseupObj.
      for (let i = 0; i < elements.length; i++) {
        const obj = JSON.parse(elements[i].getAttribute("mouseupObj"));
        if (obj) { // If this rectangle has a mouseup object...
          if (obj.subclass) {
            this[obj.subclass][obj.method](elements[i], evnt, obj.args);
          }
          else {
            this[obj.method](elements[i], evnt, obj.args);
          }
        }
      }
    }
  }

  dragSelect(SVG, evnt) {
    // Get current relative location of mouse
    const x = evnt.clientX;
    const y = evnt.clientY;
    const bound = SVG.getBoundingClientRect();
    const top = bound.top;
    const left = bound.left;
    const viewBox = SVG.getAttribute("viewBox").split(" ");
    const relX = x - left + parseInt(viewBox[0]);
    const relY = y - top + parseInt(viewBox[1]);

    // Calculate x, y, height and width of select rectangle. x and y are top-left corner: the LOWER numbers
    SVG.appendChild(this.selectBox);
    this.selectBox.setAttribute("x", Math.min(relX, this.selectBoxCorner[0]));
    this.selectBox.setAttribute("y", Math.min(relY, this.selectBoxCorner[1]));
    this.selectBox.setAttribute("height", Math.abs(relY - this.selectBoxCorner[1]));
    this.selectBox.setAttribute("width", Math.abs(relX - this.selectBoxCorner[0]));
  }

  stopDragSelect(SVG, evnt) {
    // Remove listeners
    SVG.removeAttribute("onmousemove");
    SVG.removeAttribute("onmouseup");

    const select = this.selectBox.getBoundingClientRect();

    // Select nodes
    // For every label...
    for (let i = 0; i < this.d3Functions.objects.length; i++) {
      if (this.d3Functions.objects[i]) { // If the label still exists
        // Check whether it overlaps the select box, and add it to the list of selected nodes if it does
        const label = this.d3Functions.objects[i].DOMelements.node;
        if (label) {
          const box = label.getBoundingClientRect();
          const inHorizontal = (select.left < box.left && box.left < select.right)
                            || (select.left < box.right && box.right < select.right);
          const inVertical = (select.top < box.top && box.top < select.bottom)
                          || (select.top < box.bottom && box.bottom < select.bottom);
          if (inVertical && inHorizontal) {
            this.selectedNodes.add(label.parentElement);
            label.parentElement.classList.add("selected");
          }
        }
      } //
    }

    // Remove box
    this.selectBox.setAttribute("x", 0);
    this.selectBox.setAttribute("y", 0);
    this.selectBox.setAttribute("height", 0);
    this.selectBox.setAttribute("width", 0);
    this.selectBox.classList.add("hidden");
  }

  // obj should be a JS object, containing an instance and a details object which has rows each of which also has an instance
  stripInstances(obj) {
    const copy = Object.assign({}, obj);
    delete copy.instance;

    // Copy and delete instances from the details array too
    const detailCopy = Array.from(copy.details)
    for (let j = 0; j < detailCopy.length; j++) {
      const lineCopy = Object.assign({}, detailCopy[j]);
      delete lineCopy.instance;
      detailCopy[j] = lineCopy;
    }

    copy.details = detailCopy;
    return copy;
  }

  // Check whether a new node is needed (because the map has never been saved before, or the user clicked "Save As").
  // If so, create the new node and call setOwner. If not, call setOwner if the map has no owner, or startNodes if it has an owner.
  startSave(button) {
    let name = app.domFunctions.getChildByIdr(this.widgetDOM, "name").textContent;
    const id = this.mapID;
    let newMap = false;
    // If the mind map doesn't have an ID (indicating that it hasn't been saved),
    // or if the user clicked the "Save As" button, indicating they want to make a copy with a new name:
    // ask for the name, set the name in the title, and mark the mindmap as "new".
    if (typeof id === "undefined" || id == null || button.getAttribute("idr") == "saveAs") {
      name = prompt("Please enter the name for this mind map", name);
      if (name != null) {
        newMap = true;
        const obj = {};
        obj.from = {"type":"mindmap", "properties":{"name":name}};
        obj.rel = {"type":"Owner"};
        obj.to = {"id":app.login.userID};

        const xhttp = new XMLHttpRequest();
        const SVG = this;
        const update = app.startProgress("Saving mindmap");

        xhttp.onreadystatechange = function() {
          if (this.readyState == 4 && this.status == 200) {
            const data = JSON.parse(this.responseText);
            app.stopProgress(update);
            SVG.checkNameExists(data, name, newMap);
          }
        };

        xhttp.open("POST","");
        const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
        xhttp.send(JSON.stringify(queryObject));         // send request to server
      }
    }
    else {
      this.checkOwner(name, newMap);
    }
  }

  checkNameExists(data, name, newMap) {
    if (data && data.length > 0) {
      name = prompt("Sorry, you already have a map with that name. Please choose another", name);
      if (name != null) {
        const obj = {};
        obj.from = {"type":"mindmap", "properties":{"name":name}};
        obj.rel = {"type":"Owner"};
        obj.to = {"id":app.login.userID};

        const xhttp = new XMLHttpRequest();
        const SVG = this;
        const update = app.startProgress("Checking name");

        xhttp.onreadystatechange = function() {
          if (this.readyState == 4 && this.status == 200) {
            const data = JSON.parse(this.responseText);
            app.stopProgress(update);
            SVG.checkNameExists(data, name, newMap);
          }
        };

        xhttp.open("POST","");
        const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
        xhttp.send(JSON.stringify(queryObject));         // send request to server
      }
    }
    else {
      this.checkOwner(name, newMap);
    }
  }

  checkOwner(name, newMap) {
    // Update name in title
    app.domFunctions.getChildByIdr(this.widgetDOM, "name").textContent = name;

    if (newMap) {
      const obj = {"type":"mindmap", "properties":{"name":name}};

      const xhttp = new XMLHttpRequest();
      const SVG = this;
      const update = app.startProgress("Creating mindmap");

      xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(this.responseText);
          app.stopProgress(update);
          SVG.setOwner(data); // If this is a new map or a new copy, it belongs to the user who made it
        }
      };

      xhttp.open("POST","");
      const queryObject = {"server": "CRUD", "function": "createNode", "query": obj, "GUID": app.login.userGUID};
      xhttp.send(JSON.stringify(queryObject));         // send request to server
    }
    else {
      if (this.owner) { // If the mindmap already has an owner, it still belongs to them
        this.startNodes();
      }
      else {
        this.setOwner(); // This should rarely happen - but if the mindmap already existed and DIDN'T have an owner, it belongs to this user (for now).
      }
    }
  }

  // Make the logged-in user the owner of this mindmap
  setOwner(data) { // If there is data, this was called after creating a new mindmap node. Set the ID accordingly.
    if (data) {
      this.mapID = data[0].node.id;
    }

    const obj = {};
    obj.from = {"id":this.mapID};
    obj.to = {"id":app.login.userID};
    obj.rel = {"type":"Owner"};

    const xhttp = new XMLHttpRequest();
    const SVG = this;
    const update = app.startProgress("Setting owner");

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const data = JSON.parse(this.responseText);
        app.stopProgress(update);
        SVG.startNodes(data);
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "CRUD", "function": "createRelation", "query": obj, "GUID": app.login.userGUID};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
  }

  startNodes() {
    const objsCopy = Array.from(this.d3Functions.objects);
    for (let i = 0; i < objsCopy.length; i++) {
      if (objsCopy[i] && objsCopy[i].JSobj) {
        objsCopy[i] = this.stripInstances(objsCopy[i].JSobj); // No need for instances or DOM elements
      }
    }
    this.processNodes(null, objsCopy);
  }

  processNodes(data, labels) {
    if (labels.length > 0) { // As long as there are more labels to process
      let label = labels.pop();
      while (label == undefined && labels.length > 0) {
        label = labels.pop();
      }
      if (label !== undefined) { // If a valid label was found

        const id = label.id;
        const saved = this.d3Functions.savedObjects[id];
        const original = this.d3Functions.objects[id].JSobj;
        if (label.deleted) {
          // First, remove the object from the roots array or its parent's children array
          if (label.parent == "null") {
            const rootIndex = this.d3Functions.roots.indexOf(original);
            if (rootIndex != -1) {
              this.d3Functions.roots.splice(rootIndex, 1);
            }
          }
          else {
            const parent = this.d3Functions.objects[label.parent].JSobj;
            if (parent.children) {
              const parentIndex = parent.children.indexOf(original);
              if (parentIndex != -1) {
                parent.children.splice(parentIndex, 1);
              }
            }
            else if (parent._children) {
              const parentIndex = parent._children.indexOf(original);
              if (parentIndex != -1) {
                parent._children.splice(parentIndex, 1);
              }
            }
          }

          // Now, remove the DB relation, if it exists
          if (saved && saved.inDB) {
            const obj = {};
            obj.from = {"id":this.mapID};
            obj.to = {"properties":{"M_GUID":saved.nodeID}};
            obj.rel = {"type":"MapNode", "properties":{"id":label.id}};

            const xhttp = new XMLHttpRequest();
            const SVG = this;
            const update = app.startProgress("Removing node")

            xhttp.onreadystatechange = function() {
              if (this.readyState == 4 && this.status == 200) {
                const data = JSON.parse(this.responseText);
                app.stopProgress(update);
                SVG.processNodes(data, labels);
              }
            };

            xhttp.open("POST","");
            const queryObject = {"server": "CRUD", "function": "deleteRelation", "query": obj, "GUID": app.login.userGUID};
            xhttp.send(JSON.stringify(queryObject));         // send request to server
          }
          else { // If there was already a relation, and the same node is still attached, no need to do anything except call processNodes.
            this.processNodes(null, labels);
          }
        } // end if (the label was deleted)
        else { // If this label was NOT deleted
          if (saved && saved.inDB) { // If the mindmap already has a relation for this label...
            if (label.nodeID != saved.nodeID) { // and the label is no longer connected to that node...
              saved.inDB = false;
              labels.push(label); // Prepare to process the label a second time WITHOUT the relation, to check for a new relation...
              const obj = {};
              obj.from = {"id":this.mapID};
              obj.to = {"properties":{"M_GUID":saved.nodeID}};
              obj.rel = {"type":"MapNode", "properties":{"id":label.id}};

              const xhttp = new XMLHttpRequest();
              const SVG = this;
              const update = app.startProgress("Updating node info");

              xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                  const data = JSON.parse(this.responseText);
                  app.stopProgress(update);
                  SVG.processNodes(data, labels);
                }
              };

              xhttp.open("POST","");
              const queryObject = {"server": "CRUD", "function": "deleteRelation", "query": obj, "GUID": app.login.userGUID};
              xhttp.send(JSON.stringify(queryObject));         // send request to server
            }
            else { // If there was already a relation, and the same node is still attached, no need to do anything except call processNodes.
              this.processNodes(null, labels);
            }
          }
          else { // If the mindmap does NOT already have a relation, check whether to CREATE one instead.
            if (label.nodeID != null) { // If there is a node associated with this label, merge in a relation to it
              const obj = {};
              obj.from = {"id":this.mapID};
              obj.to = {"properties":{"M_GUID":label.nodeID}};
              obj.rel = {"type":"MapNode", "properties":{"id":label.id}, "merge":true};

              const xhttp = new XMLHttpRequest();
              const SVG = this;
              const update = app.startProgress("Linking node");

              xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                  const data = JSON.parse(this.responseText);
                  app.stopProgress(update);
                  SVG.processNodes(data, labels);
                }
              };

              xhttp.open("POST","");
              const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": app.login.userGUID};
              xhttp.send(JSON.stringify(queryObject));         // send request to server
            }
            else { // If there is no new relation, no need to do anything except call processNodes.
              this.processNodes(null, labels);
            }
          } // end else (no existing relation)
        } // end else (the label was not deleted)
      } // end if (a valid label was found)
      else {
        this.setAttributes();
      }
    } // end if (there are more labels)
    else {
      this.setAttributes();
    }
  }

  setAttributes() {
    const id = this.mapID;  // This should definitely exist by now, because if it didn't exist when startSave was called, it was created then.

    // Create array of parents (starts empty)
    const parents = [];

    // Copy roots array (with pointers to original root objects) and strip instances
    const rootsCopy = Array.from(this.d3Functions.roots);
    for (let i = 0; i < rootsCopy.length; i++) {
      rootsCopy[i] = this.stripInstances(rootsCopy[i]);
      if (rootsCopy[i].children && rootsCopy[i].children.length > 0 || rootsCopy[i]._children && rootsCopy[i]._children.length > 0) {
        parents.push(rootsCopy[i]);
      }
    }

    // Strip instances from all non-root label objects
    while (parents.length > 0) {
      const obj = parents.pop();
      let kids = null;
      if (obj.children) {  // Get the children array, whether hidden or not
        kids = Array.from(obj.children);
        obj.children = kids;
      }
      else  {
        kids = Array.from(obj._children);
        obj._children = kids;
      }
      for (let i = 0; i < kids.length; i++) {
        kids[i] = this.stripInstances(kids[i]);
        if (kids[i].children && kids[i].children.length > 0 || kids[i]._children && kids[i]._children.length > 0) {
          parents.push(kids[i]);
        }
      }
    }

    // At this point, rootsCopy is a copy of roots with no instances, which can be stringified.

    // Store updated information about what labels have been saved
    let nonRootObjs = [];
    this.d3Functions.savedObjects = []; // Clear the savedObjects array...
    for (let i = 0; i < rootsCopy.length; i++) { // then for every root...
      const root = rootsCopy[i];
      // Make a deep copy and store in the savedObjects array...
      this.d3Functions.savedObjects[root.id] = JSON.parse(JSON.stringify(root));

      if (root.children) { // and add its children, if any, to the nonRootObjs array.
        nonRootObjs = nonRootObjs.concat(root.children);
      }
      else if (root._children) {
        nonRootObjs = nonRootObjs.concat(root._children);
      }

      // Also, update the root's coordinates
      const id = root.id;
      const tree = this.d3Functions.objects[id].DOMelements.tree;
      const transform = tree.getAttribute("transform").slice(10, -1).split(' '); // Get the transformation string and extract the coordinates
      root.x = parseFloat(transform[0]);
      root.y = parseFloat(transform[1]);
    }

    while (nonRootObjs.length > 0) { // While there are more nonroot objects...
      const label = nonRootObjs.pop();
      // Make a deep copy and store in d3Functions' savedObjects array
      this.d3Functions.savedObjects[label.id] = JSON.parse(JSON.stringify(label));

      if (label.children) {
        nonRootObjs = nonRootObjs.concat(label.children);
      }
      else if (label._children) {
        nonRootObjs = nonRootObjs.concat(label._children);
      }
    }
    // Done copying all labels to savedObjects array

    // Run the actual query and callback to update
    const obj = {};
    obj.node = {"id":this.mapID};
    obj.changes = [{"property":"M_roots", "value":app.stringEscape(JSON.stringify(rootsCopy))},
                   {"property":"M_count", "value":this.d3Functions.count}];

    const xhttp = new XMLHttpRequest();
  	const d3 = this.d3Functions;
    const update = app.startProgress("Saving mindmap data");

  	xhttp.onreadystatechange = function() {
  		if (this.readyState == 4 && this.status == 200) {
  			const data = JSON.parse(this.responseText);
        app.stopProgress(update);
  			d3.update(data);
  		}
  	};

  	xhttp.open("POST","");
  	const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": app.login.userGUID};
  	xhttp.send(JSON.stringify(queryObject));         // send request to server

    // Meanwhile, save information from the details pane.
    this.details.id = this.mapID;
    this.details.saveAdd();
  }

  lookForEnter(input, evnt) { // Makes hitting enter do the same thing as blurring (e. g. inserting a new node or changing an existing one)
    if (evnt.keyCode === 13) {
      input.onblur();
    }
  }

  saveInput(edit) {
    if (this.d3Functions.editNode != null) { // This SHOULD only run when there's a node being edited, but it doesn't hurt to check
      const editObj = this.d3Functions.objects[this.d3Functions.editNode].JSobj;
      editObj.name = edit.value;
      this.d3Functions.editNode = null;
    }
    // Even if there is no new object, hide and move the edit text box and refresh
    edit.hidden = true;
    edit.value = "";
    edit.setAttribute("style", "position:static");
    this.SVG_DOM.appendChild(edit);
    this.d3Functions.update();
  }

  toggleChildren(button, evnt) { // Toggle children.
    const group = button.parentElement;
    const d = group.__data__;

    // swap children and _children
    const temp = d.data.children;
    d.data.children = d.data._children;
    d.data._children = temp;

    this.makeSelectedNode(group);
    this.d3Functions.update();
  }

  toggleDetails(button, evnt) {
    const group = button.parentElement;
    const ID = group.getAttribute("idr").slice(5); // the IDR will be like groupxxx
    const obj = this.d3Functions.objects[ID].JSobj;
    if (obj.type != "") {
      // Look for an existing popup for this node (there should be one).
      const popup = this.d3Functions.objects[ID].DOMelements.popupGroup;
      const tree = group.parentElement;
      if (popup.classList.contains("hidden")) { // In order to make sure this popup is on top...
        group.appendChild(popup); // Make the popup top in its node group...
        tree.appendChild(group); // and the node top in its tree...
        this.SVG_DOM.appendChild(tree); // and the tree top in the SVG.
        popup.classList.remove("hidden")
      }
      else {
        popup.classList.add("hidden");
      }
    }
    this.makeSelectedNode(group);
  }

  toggleNotes(button, evnt) {
    const ID = button.getAttribute("idr").slice(4); // idr is like notexxx
    const obj = this.d3Functions.objects[ID].JSobj;
    if (this.notesLabel == obj) { // If this label's notes are shown already
      this.notesLabel.notes = this.notesText.value;
      this.notesLabel.notesHeight = this.notesText.clientHeight;
      this.notesLabel.notesWidth = this.notesText.clientWidth;
      this.notesLabel = null;
      this.notesText.hidden = true;
      this.notesText.value = "";
      this.notesText.setAttribute("style", "position:static");
      this.SVG_DOM.appendChild(this.notesText);
      this.d3Functions.update();
    }
    else { // If this label's notes are NOT already shown
      this.SVG_DOM.parentElement.appendChild(this.notesText);
      this.notesText.hidden = false;
      let heightString = "";
      let widthString = "";

      // Get the object data
      if (obj.notes) {
        this.notesText.value = obj.notes;
      }

      if (obj.notesHeight) { // If it has a notesHeight, it will also have a notesWidth
        heightString = ` height:${obj.notesHeight}px;`;
        widthString = ` width:${obj.notesWidth}px;`;
      }

      // Get the rectangle's location
      const rect = this.d3Functions.objects[ID].DOMelements.node;
      const bounds = rect.getBoundingClientRect();
      let leftPos = bounds.left + window.scrollX + this.d3Functions.nodeWidth;
      let topPos = bounds.top + window.scrollY;

      // Make the notes text area visible
      this.notesText.setAttribute("style", `position:absolute; left:${leftPos}px; top:${topPos}px;${heightString}${widthString}`);

      this.notesLabel = obj;
      this.notesText.select();

      this.makeSelectedNode(rect.parentElement);
    } // end else (notes are not shown; show them)
  }

  // Show or hide explanations for inactive buttons
  toggleExplain(button, evnt, prefix) {
    const group = button.parentElement;
    const tree = group.parentElement;
    const ID = group.getAttribute("idr").slice(5); // the IDR will be like groupxxx
    const text = this.d3Functions.objects[ID].DOMelements[`${prefix}Expln`];
    const box = this.d3Functions.objects[ID].DOMelements[`${prefix}ExpBox`];

    if (evnt.type == "mouseover") { // SHOW the explanation, if applicable
        this.SVG_DOM.appendChild(tree);
        tree.appendChild(group);
        group.appendChild(box);
        group.appendChild(text);

        text.classList.remove("hidden"); // Then show it
        box.classList.remove("hidden");
      // }
    }

    else { // HIDE the explanation
      text.classList.add("hidden");
      box.classList.add("hidden");
    }
  }

  // If the label has a link attached, opens that link in a new tab.
  // If it has a mindmap or calendar attached, opens the mindmap or calendar.
  // If it has any other type of node attached, opens a widgetNode table showing that node's details.
  showNode(button, evnt) {
    const data = button.parentElement.parentElement.__data__.data;
    const GUID = data.nodeID;
    const type = data.type;

    switch(type) {
      case 'mindmap':
        new widgetSVG(this.widgetID, GUID);
        break;
      case 'calendar':
        new widgetCalendar(this.widgetID, GUID);
        break;
      case 'link':
        window.open(data.details[0].value); // For now, assume the uri is the first (and only) detail
        break;
      case 'file':
        alert ("Still working on this");
        break;
      default:
        new widgetNode(this.widgetID, data.DBType, GUID);
    }
  }

  disassociate(button, evnt) {
    // Get object
    const ID = button.getAttribute("idr").slice(12); // This IDR will be like "disassociatexxx"
    const obj = this.d3Functions.objects[ID].JSobj;
    // reset node ID, type and details
    obj.nodeID = null;
    obj.type = "";
    obj.details = [];

    // Close detail popup
    const popup = this.d3Functions.objects[ID].DOMelements.popupGroup;
    popup.classList.add("hidden");

    // Check whether to hide buttons
    this.checkHideButtons(button.parentElement, evnt);

    this.d3Functions.update();
  }

  makeSelectedNode(group) {
    if (this.selectedNodes.size > 0) {
      for (let node of this.selectedNodes) {
        // If THIS isn't the node in question
        if (node != group) {
          const id = node.getAttribute("idr").slice(5); // groupxxx
          this.hideEverything(id);
          node.classList.remove("selected");
        }
      }
      this.selectedNodes.clear();
    }
    this.selectedNodes.add(group);
    group.classList.add("selected");
  }

  toggleSelectedNode(rect) {
    const group = rect.parentElement;
    // If this group was already selected, deselect it
    if (this.selectedNodes.has(group)) {
      this.selectedNodes.delete(group);
      group.classList.remove("selected");
    }

    // If it wasn't already selected, select it
    else {
      this.selectedNodes.add(group);
      group.classList.add("selected");
    }
  }

  // Make the buttons (and their text) visible when the main rect is moused over
  showButtons(rect) {
    const group = rect.parentElement;
    const ID = group.getAttribute("idr").slice(5); // the IDR will be like groupxxx
    let prefixes = [];
    if (rect.classList.contains("deletedData")) {
      prefixes = ["restore", "restoreText"];
    }
    else {
    prefixes = ["toggle", "toggleText1",
                      "note", "showNotesText1",
                      "detail", "showDetailsText1",
                      "edit", "editText1"];
    }
    for (let i = 0; i < prefixes.length; i++) {
      const idr = prefixes[i] + ID;
      const element = this.d3Functions.objects[ID].DOMelements[prefixes[i]];
      group.appendChild(element);
      element.classList.remove("hidden");
    }
  }

  // Hide the buttons if:
    // The mouse isn't over the main rect
    // The mouse isn't over any of the buttons
    // The details popup isn't visible
    // The notes panel isn't visible
  checkHideButtons(element, evnt) { // element is an element in the group - the main rectangle or one of the buttons, usually
    const x = evnt.clientX;
    const y = evnt.clientY;
    let inAnything = false;

    const group = element.parentElement;
    const ID = group.getAttribute("idr").slice(5); // the IDR will be like groupxxx

    const prefixes = ["node", "toggle", "note", "detail", "edit", "restore"];
    for (let i = 0; i < prefixes.length; i++) {
      const idr = prefixes[i] + ID;
      const element = this.d3Functions.objects[ID].DOMelements[prefixes[i]];
      const bound = element.getBoundingClientRect();
      const inElement = bound.left <= x && x <= bound.right && bound.top <= y && y <= bound.bottom;
      if (inElement) {
        inAnything = true;
        break;
      }
    }

    const detailPopup = this.d3Functions.objects[ID].DOMelements.popupGroup;
    const popupOpen = !(detailPopup.classList.contains("hidden"));

    const obj = this.d3Functions.objects[ID].JSobj;
    const editing = this.notesLabel == obj;

    if (!(inAnything || popupOpen || editing)) {
      this.hideEverything(ID);
    }
  }

  hideEverything(ID) {
    const prefixes = ["toggle", "toggleText1", "toggleExpln", "toggleExpBox",
                      "note", "showNotesText1", "noteExpln", "noteExpBox",
                      "detail", "detailExpln", "showDetailsText1", "detailExpBox",
                      "edit", "editText1", "editExpln", "editExpBox",
                      "restore", "restoreText", "restoreExpln", "restoreExpBox",
                      "popupGroup"];

    for (let i = 0; i < prefixes.length; i++) {
      const idr = prefixes[i] + ID;
      const element = this.d3Functions.objects[ID].DOMelements[prefixes[i]];
      element.classList.add("hidden");
    }

    const obj = this.d3Functions.objects[ID].JSobj;
    const editing = this.notesLabel == obj;

    if(editing) {
      const note = this.d3Functions.objects[ID].DOMelements.note;
      this.toggleNotes(note);
    }
  }
}
