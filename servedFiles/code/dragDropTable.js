// This class extends dragDrop and is specifically for tables whose rows are draggable.
class dragDropTable extends dragDrop {
  // templateIDR: The idr of the row that will serve as a template for the table. Each new row added will match the template.
  // containerIDR: The idr of the element which will contain all the rows (generally a table or tbody)
  // containerDOM: The DOM element that contains the parent widget - both the template and container should be inside it.
  // row: number of rows already in the table - start numbering them here
  // content: number of cells already in the table that can be interacted with and need idrs - start numbering them here.
  constructor(templateIDR, containerIDR, containerDOM, row, content) {
    // Store the DOM elements of the template and container
    let template = null;
    if (templateIDR) {
      template = app.domFunctions.getChildByIdr(containerDOM, templateIDR);
    }
    const container = app.domFunctions.getChildByIdr(containerDOM, containerIDR, true);

    // The container should be either a table or a tbody in a table. The table should be made a widget.
    let table = container;
    while (table.tagName !== 'TABLE' && table.parentElement) { // Look up for a table until you find one, or you reach the top of the DOM tree
      table = table.parentElement;
    }
    table.setAttribute("class", "widget");
    table.setAttribute("id", app.idCounter);

    // copies a template element, replacing th elements with td elements. Defined here because for some reason,
    // a subclass's constructor can't call methods defined OUTSIDE the constructor until AFTER it's called super().
    function createInsertElement(templateEl) {
      let newEl;
      if(templateEl.tagName == 'TH') { // Can't just clone it because we want to change the tag. Create a new element and copy the attributes instead
        newEl = document.createElement('TD');

        // Copy the attributes
        for (let i = templateEl.attributes.length - 1; i >= 0; --i) {
          const nodeName  = templateEl.attributes.item(i).nodeName;
          const nodeValue = templateEl.attributes.item(i).nodeValue;

          newEl.setAttribute(nodeName, nodeValue);
        }
      }
      else {
        newEl = templateEl.cloneNode(false); // Not a deep copy - in case there are ths inside which ought to become tds
      }

      newEl.removeAttribute("id"); // We don't want to copy IDs - they should be unique if they are used at all.

      if (templateEl.hasChildNodes()) {
        const children = templateEl.children;
        for (let child of children) {
          newEl.appendChild(createInsertElement(child)); // calls this recursively to copy all the template's children and add them to the copy
        }
      }
      return newEl; // return the finished element
    } // End function (createInsertElement)

    let showHideIDR = null;
    if (template) {
      const insertRow = createInsertElement(template); // Create the row to insert
      container.appendChild(insertRow); // append it to container
      // Create a show/hide button and add it to the header row
      const newCell = document.createElement('TH');
      const showHide = document.createElement('input');
      showHide.setAttribute("type", "button");
      showHide.setAttribute("idr", "showHide");
      newCell.appendChild(showHide);
      template.appendChild(newCell);
      showHideIDR = "showHide";
    }

    super(containerIDR, showHideIDR, row, content); // After that point the original constructor should do the trick
  }

  // Overrides the createDelete method in the original dragDrop class. The only difference is that the original
  // appends the delete button directly to a line, and this version puts it in a cell and appends the cell to a table row.
  createDelete(line) {
    // Create a button with the text "Delete"
    const button = document.createElement("button");
    const text = document.createTextNode("Delete");
    button.appendChild(text);
    // Give it an idr unique to that line, and increment itemCount in the process
    button.setAttribute("idr", `delete${this.itemCount++}`);
    // Make it call delete when clicked
    button.setAttribute("onclick", "app.widget('delete', this)");
    // Append it (in a cell) to the end of the line
    const cell = document.createElement("td");
    cell.appendChild(button);
    line.appendChild(cell);
  }

  // Overrides the delete method in the original dragDrop class. The only difference is that in the original,
  // the line was the delete button's parent, and in this, it's the delete button's grandparent,
  // because the button is in a cell.
  delete(button) {
    // logging
    const obj = {};
    obj.id = app.domFunctions.widgetGetId(button);
    obj.idr = button.getAttribute("idr");
    obj.action = "click";
    this.log(JSON.stringify(obj));
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);

    const line = button.parentNode.parentNode; // Get the line to be deleted...
    line.parentNode.removeChild(line); // and delete it.
  }
}
