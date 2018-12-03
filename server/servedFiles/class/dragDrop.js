// This class handles basic dragging and dropping.
class dragDrop {
  // containerIDR: The idr of the element which will contain the draggable items
  // buttonIDR: // The idr of the show/hide button
  // row: // The number of draggable items that already exist (start numbering from here)
  // content: The number of existing items that can be interacted with and need idrs (start numbering them from here)
  // id: The ID for the widget (use app.idCounter if not specified)
  constructor(containerIDR, buttonIDR, row, content, id) {

    this.activeNode = null; // node which is being dragged
    this.showHide = null;
    this.editDOM = null;
    this.domElement = null;
    this.container = null;
    this.insertContainer = null;
    this.domFunctions 	= new domFunctions();

    this.inputCount = 0; // number of input fields in the input element
    this.otherCount = 0; // number of non-input fields

    this.itemCount = 0;
    if (row) {
      this.itemCount = row; // Number of finished rows which have been added
    }

    this.contentCount = 0;
    if (content) { // existing is an optional value recording the number of rows that are already in the table.
      this.contentCount = content;
    }

    // add to app.widgets
    if (id) {
      this.id = id;
      app.widgets[id] = this;
    }
    else {
      this.id = app.idCounter;
      app.widgets[app.idCounter++] = this;
    }

    this.domElement = document.getElementById(this.id);

    // Set up Show/Hide button
    if (buttonIDR) {
      this.showHide = this.domFunctions.getChildByIdr(this.domElement, buttonIDR);
      this.showHide.value = "Hide Input";
      this.showHide.setAttribute("onclick", "app.widget('inputToggle', this)");
    }

    // Set up edit input
    this.editDOM = document.createElement("input");
    this.editDOM.setAttribute("type", "text");
    this.editDOM.setAttribute("onblur", "app.widget('save', this)");
    this.editDOM.setAttribute("onkeydown", "app.widget('lookForEnter', this, event)");
    this.editDOM.setAttribute("hidden", "true");
    this.editDOM.setAttribute("idr", "edit");
    this.domElement.appendChild(this.editDOM);           // move input field to end of DOM element representing the table

    this.container = this.domFunctions.getChildByIdr(this.domElement, containerIDR, true);

    // This is where we start building the insert line. insertContainer is the outermost template tag (the draggable one) (or the only one, if they're not nested)
    this.insertContainer = this.container.lastElementChild;
    if (!this.insertContainer.hasAttribute("ondrop")) { // If there's already an ondrop event set up, don't replace it
      this.insertContainer.setAttribute("ondrop", "app.widget('drop', this, event)");
    }
    if (!this.insertContainer.hasAttribute("ondragover")) { // Same goes for ondragover...
      this.insertContainer.setAttribute("ondragover", "event.preventDefault()");
    }
    this.insertContainer.setAttribute("draggable", "true");
    if (!this.insertContainer.hasAttribute("ondragstart")) { // and ondragstart.
      this.insertContainer.setAttribute("ondragstart", "app.widget('drag', this, event)");
    }

    this.createInputs(this.insertContainer);
    this.insertContainer.setAttribute("idr", "insertContainer");

  }

  createInputs(element) { // To support nested tags
    if (element.hasChildNodes()) { // If this is not a leaf, process its children.
      const children = element.children;
      for (let child of children) {
        this.createInputs(child); // calls this recursively to process all leaves
      }
    }
    if (element.hasAttribute("editable")) { // Create inputs for each editable node
      const input = document.createElement("input");
      input.setAttribute("onchange", "app.widget('recordText', this)");
      input.setAttribute("onkeydown", "app.widget('lookForEnter', this, event)");
      input.setAttribute("onblur", "app.widget('insert', this)");
      input.setAttribute("idr", `input${this.inputCount++}`);
      element.insertBefore(input, element.firstChild);
    }
    else {
      element.setAttribute("idr", `inputOther${this.otherCount++}`);
    }
  }

  drag(input, evnt){ // sets value of activeNode and data
    this.activeNode = evnt.target;

    const data = {};
    data.sourceID = app.domFunctions.widgetGetId(input);
    data.sourceType = "dragDrop";
    data.sourceTag = input.tagName;
    evnt.dataTransfer.setData("text/plain", JSON.stringify(data));

    const obj = {};
    obj.id = this.domFunctions.widgetGetId(evnt.target);
    obj.idr = event.target.getAttribute("idr");
    obj.action = "dragstart";
    this.log(JSON.stringify(obj));
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  allowDrop(input, evnt){ // the event doesn't take its default action
  	evnt.preventDefault();
  }

  drop(input, evnt) { // drops the active node above or below the target. evnt is the drop event and its target is what's being dropped onto.
  	evnt.preventDefault();

    const dataText = evnt.dataTransfer.getData("text/plain");
    const data = JSON.parse(dataText);

    if (data.sourceType == "dragDrop" && data.sourceID == this.id) { // Make sure the data comes from this table
      let target = evnt.target;
      while (target.draggable == false) { // Also for nested tags
        target = target.parentNode;
      }
      if (this.activeNode) { // If activeNode exists
      	if (this.activeNode.offsetTop < target.offsetTop || // drag down
          this.activeNode.offsetTop == target.offsetTop && this.activeNode.offsetLeft < target.offsetLeft) { // drag left
      		target.parentNode.insertBefore(this.activeNode, target.nextSibling); // Insert after target
      	}
        else { // drag up or right
      		target.parentNode.insertBefore(this.activeNode, target); // Insert before target
      	}
      }

      this.activeNode = null;
      const obj = {};
      obj.id = this.domFunctions.widgetGetId(evnt.target);
      obj.idr = target.getAttribute("idr");
      obj.action = "drop";
      this.log(JSON.stringify(obj));
      app.regression.log(JSON.stringify(obj));
      app.regression.record(obj);
    }
  }

  lookForEnter(input, evnt) { // Makes hitting enter do the same thing as blurring (inserting a new node or changing an existing one)
    if (evnt.keyCode === 13) {
      input.onblur();
    }
  }

  insertElement(element) { // Element is all or part of insertContainer
    const newEl = element.cloneNode(false);

    if (element.hasChildNodes()) { // If this element has any children (may be inputs or nested elements)
      if (element.firstElementChild.tagName == "INPUT") { // If this element has an input child
        const input = element.firstElementChild; // Get the input inside it
        const text = input.value;
        newEl.appendChild(document.createTextNode(text)); // Copy text to the new node
        newEl.setAttribute("ondblclick", "app.widget('edit', this, event)"); // make new node editable
        input.value = ""; // erase input
      }
      const children = element.children;
      for (let i=0; i<children.length; i++) {
        if (children[i].tagName !== "INPUT") { // Don't duplicate the input itself
          const childEl = this.insertElement(children[i]);
          newEl.appendChild(childEl);
        }
      }
    } // end if (element has children). No else - a node with no input and no child elements doesn't need special processing.
    newEl.setAttribute("idr", `content${this.contentCount++}`); // Set the idr of the new node
    return newEl;
  }

  insert(input, row) { // Insert a new node. Default position is just before the insert row. Can pass in a different row to insert just before that row.
    if (input) {
      // Log first so input hasn't been deleted yet. Log only if insert was triggered by an input - if it's triggered by something else, the other thing will log it.
      const obj = {};
      obj.value = input.value;
      obj.id = this.domFunctions.widgetGetId(input);
      obj.idr = input.getAttribute("idr");
      obj.action = "keydown";
      obj.key = "Enter";
      this.log(JSON.stringify(obj));
      app.regression.log(JSON.stringify(obj));
      app.regression.record(obj);
    }

    const newEl = this.insertElement(this.insertContainer); // Should create an appropriately nested element with data in leaves

    if (row) {
      // Insert the new element before the given row
      this.container.insertBefore(newEl, row);

    }
    else {
      // Insert the new element before the input
      this.container.insertBefore(newEl, this.insertContainer);
    }

    // set all the draggable functions
    if (!newEl.hasAttribute("ondrop")) { // If there's already an ondrop event set up, don't replace it
      newEl.setAttribute("ondrop", "app.widget('drop', this, event)");
    }
    if (!newEl.hasAttribute("ondragover")) { // Same goes for ondragover...
      newEl.setAttribute("ondragover", "event.preventDefault()");
    }
    newEl.setAttribute("draggable", "true");
    if (!newEl.hasAttribute("ondragstart")) { // and ondragstart.
      newEl.setAttribute("ondragstart", "app.widget('drag', this, event)");
    }

    newEl.setAttribute("idr", `item${this.itemCount}`);
    newEl.setAttribute("class", "newData");

    this.contentCount--; // The outer, draggable element was originally given an idr of content{this.contentCount++}, but it doesn't keep that idr. Decrement contentCount so that idr can be used again.

    this.createDelete(newEl);

    return newEl;
  }

  createDelete(line) {
    const button = document.createElement("button");
    const text = document.createTextNode("Delete");
    button.appendChild(text);
    button.setAttribute("idr", `delete${this.itemCount++}`);
    button.setAttribute("onclick", "app.widget('delete', this)");
    line.appendChild(button);
  }

  delete(button) {
    // logging
    const obj = {};
    obj.id = this.domFunctions.widgetGetId(button);
    obj.idr = button.getAttribute("idr");
    obj.action = "click";
    this.log(JSON.stringify(obj));
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);

    const line = button.parentNode;
    line.parentNode.removeChild(line);
  }

  markForDeletion(button) {
    // logging
    const obj = {};
    obj.id = this.domFunctions.widgetGetId(button);
    obj.idr = button.getAttribute("idr");
    obj.action = "click";
    this.log(JSON.stringify(obj));
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);

    const line = button.parentNode.parentNode;
    if (line.classList.contains("deletedData")) {
      line.classList.remove("deletedData");
      button.textContent = "Delete";
    }
    else {
      line.classList.add("deletedData");
      button.textContent = "Restore";
    }
  }

  edit(input, evnt) { // edit an existing node
    if (evnt.target.tagName !== "TEXTAREA" && evnt.target.tagName !== "INPUT") { // Dblclicking on a text box is more likely meant to select text
      this.activeNode = evnt.target;  // remember item that we are editing
      let closeButton;
      let hasClose = false;

      // NOTE: This is a kludge! Fix if possible
      if (this.activeNode.children.length > 0) { // since only leaves are editable, this.activeNode has no children other than possibly a close button.
        closeButton = this.activeNode.firstElementChild;
        this.activeNode.removeChild(closeButton); // Temporarily remove the close button so it won't get caught up in textContent.
        closeButton.hidden = true;  // Also, hide it because clicking it while editing doesn't work
        hasClose = true;
      }

      // make input element visible
      const el = this.domFunctions.getChildByIdr(this.domElement, "edit");
      el.value = evnt.target.textContent;  // init value of input
      el.hidden = false;      // make input visible

      // Erase the text from the target (it will show up in ed instead)
      evnt.target.textContent = "";

      // Add the input element to the target
      evnt.target.appendChild(el);
      el.select();

      // Put the close button back
      if (hasClose) {
        evnt.target.appendChild(closeButton);
      }

      // Log
      const obj = {};
      obj.id = this.domFunctions.widgetGetId(evnt.target);
      obj.idr = event.target.getAttribute("idr");
      obj.action = "dblclick";
      this.log(JSON.stringify(obj));
      app.regression.log(JSON.stringify(obj));
      app.regression.record(obj);
    }
  }

  save(){ // Save changes to a node
    const el = this.domFunctions.getChildByIdr(this.domElement, "edit");
    el.hidden=true; 		 // hide input element
    const text = document.createTextNode(el.value);
    el.parentElement.insertBefore(text, el); // Add the input text to the selected node
    this.domElement.appendChild(el);           // move input field to end of DOM element representing the table
    if (this.activeNode.children.length > 0) { // since only leaves are editable, this should be true ONLY if there's a close button attached
      const closeButton = this.activeNode.firstElementChild;
      closeButton.hidden = false;
    }
    this.activeNode = null;

    // Log
    const obj = {};
    obj.id = this.domFunctions.widgetGetId(el);
    obj.idr = el.getAttribute("idr");
    obj.value = el.value;
    obj.action = "blur";
    this.log(JSON.stringify(obj));
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  log(text) { // Add a message to the eventLog
    const ul = document.getElementById("eventLog");
    if (ul) {
      const li = document.createElement("li");
      li.appendChild(document.createTextNode(text));
      ul.appendChild(li);
    }
  }

  inputToggle(button) { // Toggles visibility of the input text box and value of the Show/Hide button.
    this.insertContainer.hidden = !this.insertContainer.hidden;
    if (this.insertContainer.hidden) {
      button.value = "Show input";
    }
    else {
      button.value = "Hide input";
    }

    // log
    const obj = {};
    obj.id = this.domFunctions.widgetGetId(button);
    obj.idr = button.getAttribute("idr");
    obj.action = "click";
    this.log(JSON.stringify(obj));
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  recordText(input) {
    const obj = {};
    obj.id = this.domFunctions.widgetGetId(input);
    obj.idr = input.getAttribute("idr");
    obj.value = input.value;
    obj.action = "change";
    this.log(JSON.stringify(obj));
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  test() { // This is where I put code I'm testing and want to be able to fire at will. There's a test button on 1-drag.html to fire it.
  }
}
