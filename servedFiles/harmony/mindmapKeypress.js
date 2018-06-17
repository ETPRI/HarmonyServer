class mindmapKeypress {
  constructor(d3Functions, tabFunction, enterFunction, parent) {
    this.d3Functions = d3Functions;
    this.tabFunction = tabFunction;
    this.enterFunction = enterFunction;
    this.parent = parent;
  }

  keyPressed(evnt) {
    if (evnt.target != this.d3Functions.editDOM) {
      switch (evnt.which) {
        case 9:
          evnt.preventDefault();  // Don't jump around the page
          this.tabFunction();
          break;
        case 13:
          this.enterFunction();
          break;
        case 27:
          this.escapeKey();
          break;
        case 37:
          evnt.preventDefault(); // don't scroll
          this.leftArrow();
          break;
        case 38:
          evnt.preventDefault(); // Don't scroll
          this.upDownArrow(-1); // On an up arrow, go to the previous sibling - SUBTRACT 1 from current index
          break;
        case 39:
          evnt.preventDefault(); // don't scroll
          this.rightArrow();
          break;
        case 40:
          evnt.preventDefault(); // Don't scroll
          this.upDownArrow(1); // on a down arrow, go to the next sibling -- ADD 1 to current index
          break;
        case 46:
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
        // Remove the onmouseout from everything in the group, to avoid triggering it when the group disappears
        const prefixes = ["node", "toggle", "note", "detail"];
        for (let i = 0; i < prefixes.length; i++) {
          const idr = prefixes[i] + nodeID;
          const element = this.d3Functions.objects[nodeID].DOMelements[prefixes[i]];
          element.removeAttribute("onmouseout");
        }
        const nodeObj = this.d3Functions.objects[nodeID].JSobj; // Get the object representing this node
        const parentID = nodeObj.parent;
        if (parentID != "null") { // If the object has a parent, remove it from its parent's children array
          const parentObj = this.d3Functions.objects[parentID].JSobj;
          const parentIndex = parentObj.children.indexOf(nodeObj);
          if(parentIndex != -1) {
            parentObj.children.splice(parentIndex, 1);
          }
        }
        else { // If the object is a root, remove it from the roots array
          const rootIndex = this.d3Functions.roots.indexOf(nodeObj);
          if(rootIndex != -1) {
            this.d3Functions.roots.splice(rootIndex, 1);
          }
        }
        // Remove the object from d3Functions's objects array
        this.d3Functions.objects[nodeID] = null;
      } // end for (every selected node)
      this.parent.selectedNodes.clear();
      this.d3Functions.update();
    } // end if (there are selected nodes)
  }

  // Selects the parent of the selected node
  leftArrow() {
    let parentGroup = null;
    if (this.parent.selectedNodes.size == 1) {
      for (let node of this.parent.selectedNodes) {
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
            this.parent.toggle(button);
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

  // Go to the previous sibling, if any. If this is the first sibling, cycle around to the last one.
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
