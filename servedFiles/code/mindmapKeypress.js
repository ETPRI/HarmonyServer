class mindmapKeypress {
  constructor(d3Functions, tabFunction, enterFunction, parent) {
    this.d3Functions = d3Functions;
    this.tabFunction = tabFunction;
    this.enterFunction = enterFunction;
    this.parent = parent;
  }

  keyPressed(evnt) {
    // Keypresses while typing shouldn't have these effects
    if (evnt.target.tagName !== "INPUT" && evnt.target.tagName !== "TEXTAREA") {
      switch (evnt.which) {
        case 9: // Tab key
          // If a node was being edited, stop editing first, then apply keypress
          if (evnt.target == this.d3Functions.editDOM) {
            this.parent.saveInput(this.d3Functions.editDOM);
          }
          evnt.preventDefault();  // Don't jump around the page
          this.tabFunction();
          break;
        case 13: // Enter key.
          this.enterFunction();
          break;
        case 27: // Escape key
          // If a node was being edited, stop editing first, then apply keypress
          if (evnt.target == this.d3Functions.editDOM) {
            this.parent.saveInput(this.d3Functions.editDOM);
          }
          this.escapeKey();
          break;
        case 37: // Left arrow
          evnt.preventDefault(); // don't scroll
          this.leftArrow();
          break;
        case 38: // Up arrow
          evnt.preventDefault(); // Don't scroll
          this.upDownArrow(-1); // On an up arrow, go to the previous sibling - SUBTRACT 1 from current index
          break;
        case 39: // Right arrow
          evnt.preventDefault(); // don't scroll
          this.rightArrow();
          break;
        case 40: // Down arrow
          evnt.preventDefault(); // Don't scroll
          this.upDownArrow(1); // on a down arrow, go to the next sibling -- ADD 1 to current index
          break;
        case 46: // These are the backspace and delete keys.
        case 8:
          this.deleteKey();
          break;
      }
    }
  }

  // deselects the selected node
  escapeKey() {
    if (this.parent.selectedNodes.size > 0) {
      for (let node of this.parent.selectedNodes) {
        const id = node.getAttribute("idr").slice(5); // groupxxx
        this.parent.hideEverything(id);
        node.classList.remove("selected");
      }
      this.parent.selectedNodes.clear();
      this.d3Functions.update();
    }
  }

  // Deletes the selected node and all of its children
  deleteKey() {
    if (this.parent.selectedNodes.size > 0 && !this.parent.notesLabel) {
      for (let node of this.parent.selectedNodes) {
        const nodeID = node.getAttribute("idr").slice(5); // the IDR will be like groupxxx
        this.parent.hideEverything(nodeID); // Hide buttons, close edit textbox, etc.
        const rect = this.d3Functions.objects[nodeID].DOMelements.group;
        rect.classList.remove("selected");
        // Give the label and all its children "deleted data" formatting.
        let descendants = [];
        const labelObj = this.d3Functions.objects[nodeID].JSobj;
        labelObj.deleted = true;
        if (labelObj.children && labelObj.children.length > 0) {
          descendants = descendants.concat(labelObj.children);
        }
        if (labelObj._children && labelObj._children.length > 0) {
          descendants = descendants.concat(labelObj._children);
        }

        while (descendants.length > 0) {
          const childObj = descendants.pop();
          const id = childObj.id;
          this.parent.hideEverything(id);
          childObj.deleted = true;
          if (childObj.children && childObj.children.length > 0) {
            descendants = descendants.concat(childObj.children);
          }
          if (childObj._children && childObj._children.length > 0) {
            descendants = descendants.concat(childObj._children);
          }
        }
      }

      this.parent.selectedNodes.clear();
      this.d3Functions.update();
    } // end if (there are selected nodes)
  }

  // Selects the parent of the selected node
  leftArrow() {
    let parentGroup = null;
    if (this.parent.selectedNodes.size == 1) {
      for (let node of this.parent.selectedNodes) { // Why is this in a loop? I already verified the set size was 1!
        const nodeID = node.getAttribute("idr").slice(5); // the IDR will be like groupxxx
        const nodeObj = this.d3Functions.objects[nodeID].JSobj; // Get the object representing this node
        const parentID = nodeObj.parent;
        if (parentID != "null") { // If the object has a parent, select the parent
          parentGroup = this.d3Functions.objects[parentID].DOMelements.group;
        }
      }
      if (parentGroup) {
        this.parent.makeSelectedNode(parentGroup);
        this.d3Functions.update();
      }
    }
  }

  // Selects the first child of the selected node
  rightArrow() {
    let childGroup = null;
    if (this.parent.selectedNodes.size == 1) {
      for (let node of this.parent.selectedNodes) {
        const nodeID = node.getAttribute("idr").slice(5); // the IDR will be like groupxxx
        const nodeObj = this.d3Functions.objects[nodeID].JSobj; // Get the object representing this node
          if (nodeObj._children && nodeObj._children.length > 0) { // If the object has children, but they are hidden, show them.
            const button = this.d3Functions.objects[nodeID].DOMelements.toggle;
            this.parent.toggleChildren(button);
            // The children, if any, should now be visible.
          }
        if (nodeObj.children && nodeObj.children.length > 0) { // If the object has children, select the oldest child
          const childObj = nodeObj.children[0];
          const childID = childObj.id;
          childGroup = this.d3Functions.objects[childID].DOMelements.group;
        }
      }
      if (childGroup) {
        this.parent.makeSelectedNode(childGroup);
        this.d3Functions.update();
      }
    }
  }

  // If offset is -1 (up arrow), go to the previous sibling, if any. If this is the first sibling, cycle around to the last one.
  // If offset is 1 (down arrow), go to the next sibling, if any. If this is the last sibling, cycle around to the first one.
  upDownArrow(offset) {
    let siblingGroup = null;
    if (this.parent.selectedNodes.size == 1) {
      for (let node of this.parent.selectedNodes) {
        const nodeID = node.getAttribute("idr").slice(5); // the IDR will be like groupxxx
        const nodeObj = this.d3Functions.objects[nodeID].JSobj; // Get the object representing this node
        const parentID = nodeObj.parent;
        if (parentID != "null") { // If the object has a parent, we can cycle through its siblings, if any
          const parentObj = this.d3Functions.objects[parentID].JSobj;
          const parentIndex = parentObj.children.indexOf(nodeObj);
          let newIndex = parentIndex + offset; // Add 1 to the index to go forward (down arrow). Subtract 1 to go back (up arrow)

          // If we go too far backwards, the index will be -1. Cycle around to the last item
          if (newIndex == -1) {
            newIndex = parentObj.children.length - 1;
          }

          // If we go too far forward, the index will be equal to the array length. Cycle around to the first item.
          if (newIndex == parentObj.children.length) {
            newIndex = 0;
          }

          const siblingObj = parentObj.children[newIndex];
          const siblingID = siblingObj.id;
          siblingGroup = this.d3Functions.objects[siblingID].DOMelements.group;
        }
      }
      if (siblingGroup) {
        this.parent.makeSelectedNode(siblingGroup);
        this.d3Functions.update();
      }
    }
  }
}
