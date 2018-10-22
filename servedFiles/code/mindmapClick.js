class mindmapClick {
  constructor(parent, SVG_DOM, d3Functions) {
    this.SVG_DOM = SVG_DOM;
    this.d3Functions = d3Functions;
    this.parent = parent;

    this.draggingNode = null;
    this.initialPosition = null;
    this.currentX = null;
    this.currentY = null;

    this.parentNode = null;
    this.prevSibling = null;
    this.nextSibling = null;

    this.selectedRoots = [];
    this.transform = [];
    this.elemsToMove = [];
    this.detachDistance = 50;
    this.frontCushion = 40;
  }

  checkClickedNode(group, x, y) { // element is a group representing a node
    const rects = this.SVG_DOM.getElementsByTagName("rect"); // Get all rectangles in the mind map
    const clickedRects = [];

    for (let i = 0; i < rects.length; i++) { // Loop through all rectangles
      const rect=rects[i];
      const bound = rect.getBoundingClientRect(); // Get bounds of each rectangle
      const top = bound.top;
      const bottom = bound.bottom;
      const left = bound.left;
      const right = bound.right;

      let contains = false;
      if (group != undefined) {
        contains = group.contains(rect);
      }

      let hidden = false;
      let ancestor = rect; // Go up through the rect's parents until either you hit something hidden (indicating that
                           // the rect is hidden) or you reach the SVG (indicating that the rect is NOT part of something
                           // hidden, and is therefore visible)
      while (ancestor.parentElement != this.SVG_DOM && !(ancestor.classList.contains("hidden"))) {
        ancestor = ancestor.parentElement;
      }
      hidden = ancestor.classList.contains("hidden");
      // const deleted = rect.classList.contains("deletedData");

      if (top < y && y < bottom && left < x && x < right && !contains && !hidden) { // If the mouse is inside this element,
                                                  // and this is NOT the element being dragged or that element doesn't exist,
                                                  // and this element is visible and has not been deleted
        clickedRects.push(rect);
      }
    }
    if (clickedRects.length > 0) {
      return clickedRects;
    }
    else {
      return null;
    }
  }

  // When a rectangle is clicked, records the current mouse position and the group's transformation,
  // sets onmousemove, onmouseup and onmouseout methods for dragging, and shows its details (if any).
  selectNode(element, evnt) {
    this.parent.mindmapDetails.classList.add('hidden');
    this.d3Functions.objects[element.__data__.data.id].DOMelements.detailsTable.classList.remove('hidden');
    evnt.preventDefault();

    this.currentX = evnt.clientX; // get mouse position
    this.currentY = evnt.clientY;

    if (evnt.which == 1) {
      const group = element.parentElement;

      // Should select the label if it wasn't selected already
      if (!(this.parent.selectedNodes.has(group))) {
        this.parent.makeSelectedNode(group);
      }

      // Now  verify NOT clicking one of the buttons, since they're over labels now
      let inAnything = false;

      const ID = group.getAttribute("idr").slice(5); // the IDR will be like groupxxx

      const prefixes = ["toggle", "edit"];
      for (let i = 0; i < prefixes.length; i++) {
        const idr = prefixes[i] + ID;
        const element = this.d3Functions.objects[ID].DOMelements[prefixes[i]];
        const bound = element.getBoundingClientRect();
        const inElement = bound.left <= this.currentX && this.currentX <= bound.right
                       && bound.top <= this.currentY && this.currentY <= bound.bottom;
        if (inElement) {
          inAnything = true;
          break;
        }
      }

      if (!inAnything) { // Now we get ready to actually move.
        // The node actually being dragged - the one the mouse is over -
        // will be A selected node, but not necessarily the ONLY one
        this.draggingNode = element;

        // Because THIS is the closest SVG gets to a goddamn "Bring to front" command!
        // It just draws everything in whatever order it's listed in the DOM,
        // so to move something to the front you have to actually move the HTML that generates it forward!
        const tree = group.parentElement;
        this.SVG_DOM.appendChild(tree);
        tree.appendChild(group);

        this.elemsToMove = [];
        this.selectedRoots = [];

        for (let group of this.parent.selectedNodes) {
          // If the element being dragged is a root, it must be top-level, and drag the whole group it's part of
          if (group.__data__.data.parent == "null") {
            const move = {};
            move.group = group;
            this.selectedRoots.push(move); // Add this group to the list of top-level selected nodes...
            this.elemsToMove.push(group.parentElement); // and its entire TREE to the list of "things to move".
          }
          // Otherwise, check whether its parent is also selected. If not (it is a top-level selected node),
          // get its descendants and the lines linking it to them using the getSubtree method. Also, mark its current parent.
          else {
            const parentID = group.__data__.data.parent;
            const parentGroup = this.d3Functions.objects[parentID].DOMelements.group; // Get the label's parent group
            if (!(this.parent.selectedNodes.has(parentGroup))) { // If this label's parent is NOT selected
              this.getSubtree(group); // Add the label and its subtree to elemsToMove
              const move = {};
              move.group = group;
              move.parent = this.d3Functions.objects[parentID].DOMelements.group;
              move.parent.classList.add("currentParent");
              this.selectedRoots.push(move);

              // If ANY top-level selected node is a root, record the current position to determine whether they need to "snap back".
              this.initialPosition = [this.currentX, this.currentY];
            }
          }
        }
        this.getTransforms();

        element.setAttribute("onmousemove", "app.widget('click', this, event, 'moveNode')");
        element.setAttribute("onmouseout", "app.widget('click', this, event, 'releaseNode')");
        element.setAttribute("mouseupObj", '{"subclass":"clicks", "method":"releaseNode"}')
      }
    } // end if (left button)
  }

  editLabel(element) {
    this.releaseNode(element);
    // Check whether the label has a node attached
    const id = element.getAttribute("idr").slice(4); // The idr will look like "nodexxx"
    const obj = this.d3Functions.objects[id].JSobj;
    if (obj.nodeID == null) { // If this label has no node attached
      this.d3Functions.editNode = id; // Set the doubleclicked element as the new node, so it will be edited
      this.d3Functions.editDOM.value = obj.name; // Fill the existing name in the edit textbox...
      obj.name = ""; // and remove it from the object (so it won't show up behind the textbox)
      this.d3Functions.update(); // Finally, update the mind map, causing the text in the node to disappear and the edit box to appear.
    }

    element.removeAttribute("onmousemove");
    element.removeAttribute("onmouseout");
    element.removeAttribute("onmouseup");
  }

  getSubtree(element) {
    // Get array of ALL SVG elements to move - this node, all its children and the lines connecting it to its children
    const nodeID = element.getAttribute("idr").slice(5); // the IDR will be like groupxxx
    const nodeObj = this.d3Functions.objects[nodeID].JSobj; // Get the object representing this node
    this.elemsToMove.push(element); // A list of all elements that need to move. It starts with just the node being dragged.
    if (nodeObj.children) {
      let descendantObjs = nodeObj.children.slice(); // To list the node's descendants, start with its children. slice makes a shallow copy.
      while (descendantObjs.length > 0) {
        const currentObj = descendantObjs.pop(); // Grab a descendant object...
        let descendantSVG = this.d3Functions.objects[currentObj.id].DOMelements.group; // Get the node associated with that object
        const linkSVG = app.domFunctions.getChildByIdr(this.SVG_DOM, `link${currentObj.parent}to${currentObj.id}`); // Get the line linking that object to its parent
        this.elemsToMove.push(descendantSVG);
        this.elemsToMove.push(linkSVG);  // Add them both to the list of things to move
        if (currentObj.children) {
          descendantObjs = descendantObjs.concat(currentObj.children);
        } // Add the descendant's children (if any) to the array of descendants
      }
    }
    // When this method finishes, this.elemsToMove will contain the element, all its descendants and the lines linking them - a subtree.
  }

  getTransforms() {
    this.transform = []; // Starts off as an empty array
    // For every item in elemsToMove, extract the current transform. Store in a 2D array where the first subscript represents the object and the second represents the coordinate (x or y).
    for (let i = 0; i < this.elemsToMove.length; i++) {
      const transform = this.elemsToMove[i].getAttribute("transform");
      if (transform) {
        this.transform[i] = transform.slice(10, -1).split(' '); // Get the transformation string and extract the coordinates
      }
      else {
        this.transform[i] = ["0","0"];
      }
      this.transform[i][0] = parseFloat(this.transform[i][0]);
      this.transform[i][1] = parseFloat(this.transform[i][1]);
    }
  }

  moveNode(rect, evnt) { // Compares current to previous mouse position to see how much the element should have moved, then moves it by that much and updates the mouse position.
    // Get amount of mouse movement, and update mouse position
    const dx = evnt.clientX - this.currentX;
    const dy = evnt.clientY - this.currentY;
    this.currentX = evnt.clientX;
    this.currentY = evnt.clientY;

    // Move everything
    for (let i = 0; i < this.elemsToMove.length; i++) {
      this.transform[i][0] += dx;
      this.transform[i][1] += dy;
      const newTransform = `translate(${this.transform[i][0]} ${this.transform[i][1]})`;
      this.elemsToMove[i].setAttribute("transform", newTransform);
    }

    // Highlight the prospective parent. Add/remove highlighting from current parent if needed.
    // Rather than the current MOUSE position, use the current position of the middle of the left side of the label
    const nodeDetails = this.draggingNode.getBoundingClientRect();
    this.highlightParent(nodeDetails, rect.parentElement);

    if (this.initialPosition) { // If any of the labels being dragged were children, this variable will be defined.
      if (Math.abs(this.currentX - this.initialPosition[0]) < this.detachDistance
      &&  Math.abs(this.currentY - this.initialPosition[1]) < this.detachDistance) {
        for (let i = 0; i < this.selectedRoots.length; i++) {
          if (this.selectedRoots[i].parent) {
            this.selectedRoots[i].parent.classList.add("currentParent");
          }
        }
      }
      else {
        for (let i = 0; i < this.selectedRoots.length; i++) {
          if (this.selectedRoots[i].parent) {
            this.selectedRoots[i].parent.classList.remove("currentParent");
          }
        }
      }
    }
  }

  highlightParent(draggingNodeRect, group) {
    // Check for parent and highlight it if found
    let parent = null;
    let centerX = (draggingNodeRect.left + draggingNodeRect.right)/2;
    let centerY = (draggingNodeRect.top + draggingNodeRect.bottom)/2;
    // Check for hovering over something first, but ONLY if moving an existing box!
    // Check whether the CENTER of the node being dragged is over another node.
    if (group) {
      const rectArray = this.checkClickedNode(group, centerX, centerY);
      if (rectArray) { // If the edge of the box was over any rectangles, then check whether any of them was a nodeRect.
        for (let i = 0; i < rectArray.length; i++) {
          if (rectArray[i].classList.contains("nodeRect") && !(rectArray[i].classList.contains("deletedData"))) {
            parent = rectArray[i].parentElement;
          }
        }
      }
    }

    // If no parent was found in the last step, next check for being near enough to link to other elements.
    if (!parent) {
      parent = this.checkNear(group, draggingNodeRect);
    }

    if (parent && parent != this.parentNode) { // If a new parent (not the one already marked) has been found
      parent.classList.add("parent"); // Format it as the new parent, and remove formatting from the old parent
      if (this.parentNode) {
        this.parentNode.classList.remove("parent");
      }
      this.parentNode = parent;
    }

    if (!parent && this.parentNode) { // If there's an existing parent node, but no node should be the parent node
      this.parentNode.classList.remove("parent"); // remove parent formatting
      this.parentNode = null;
    }
  }

  checkNear(element, draggingNodeRect) {
    const centerX = (draggingNodeRect.left + draggingNodeRect.right)/2;
    const centerY = (draggingNodeRect.top + draggingNodeRect.bottom)/2;
    const leftX = draggingNodeRect.left;

    const groups = this.SVG_DOM.getElementsByClassName("node"); // Get all label groups in the mind map
    let prev = null;
    let next = null;
    let parent = null;
    for (let i = 0; i < groups.length; i++) { // Loop through all labels
      const group=groups[i];
      const bound = group.getBoundingClientRect(); // Get bounds of each rectangle
      const top = bound.top;
      const bottom = bound.bottom;
      const left = bound.left;
      const right = bound.right;
      let contains = false; // determine whether this rectangle is the one being dragged
      if (element) {
        contains = element.contains(group);
      }

      // Check for prospective parent...
      const kids = group.__data__.data.children;
      const noKids = (kids == null || kids.length < 1); // true if the group represents a node with no chldren visible
      const deleted = group.__data__.data.deleted;
      // If the vertical center of the dragging node in is between the top and bottom of the rectangle,
      // and the left edge of the dragging node is within this.frontCushion of the right edge of the rectangle,
      // and the rectangle isn't part of the group being dragged and has no children,
      // then the group being dragged will become its child and there's no need to worry about order
      if (top < centerY && centerY < bottom && right < leftX && leftX < right + this.frontCushion && !contains && noKids && !deleted) {
        parent = group;
      }

      // Then check for prospective sibling. Note that to be a sibling, the group must have a parent
      // (which will become the new parent of the group being dragged).
      // Check whether the CENTER of the node being dragged is just above or below the group being checked.
      if (!parent) {
        let parentExists = false;
        const parentID = group.__data__.data.parent;
        if (parentID != "null") { // If this group has a parent at all...
          const groupParent = this.d3Functions.objects[parentID].JSobj;
          if (!(groupParent.deleted)) {
            parentExists = true;
          }
        }

        const topBound = top - 20;
        const bottomBound = top;
        if (topBound < centerY && centerY < bottomBound && left < centerX && centerX < right && !contains && parentExists) {
          next = group;
          const parentID = group.__data__.data.parent;
          parent = this.d3Functions.objects[parentID].DOMelements.group;
        }
      }

      // Now check for previous sibling (the point that was passed in is just BELOW this group, and there's a parent)
      if (!parent) {
        let parentExists = false;
        const parentID = group.__data__.data.parent;
        if (parentID != "null") { // If this group has a parent at all...
          const groupParent = this.d3Functions.objects[parentID].JSobj;
          if (!(groupParent.deleted)) {
            parentExists = true;
          }
        }

        const topBound = bottom;
        const bottomBound = bottom + 20;
        if (topBound < centerY && centerY < bottomBound && left < centerX && centerX < right && !contains && parentExists) {
          prev = group;
          const parentID = group.__data__.data.parent;
          parent = this.d3Functions.objects[parentID].DOMelements.group;
        } // end if (group is previous sibling)
      } // end if (parent not found)
    } // end for (all labels)

    // At this point, the prospective parent has been found, and so has the next or previous sibling, if any.
    // Set the siblings for later use and return the parent.

    this.prevSibling = prev;
    this.nextSibling = next;
    return parent;
  }

  releaseNode(element) { // Removes all the onmousemove, onmouseup and onmouseout events which were set when the node was selected.
    // Reset mouse methods and ensure all drag variables are null
    element.removeAttribute("onmousemove");
    element.removeAttribute("onmouseup");
    element.removeAttribute("mouseupObj");
    /* If a child became a root, a root became a child, or a child moved from one tree to another,
     then its DOM element will be removed and replaced. Remove its onmouseout attribute
     so that it won't fire when the DOM element disappears. Only necessary for the element which the mouse is over while dragging.
     Best way I can see to recognize this situation: The element's tree doesn't match the current parent's tree,
     OR there is no current parent (including an existing parent to snap back to) but the element is part of an existing tree
     and the entire tree is NOT moving.
    */
    const group = element.parentElement; // The parent element of a node rectangle is a (label) group
    const elemTree = group.parentElement; // The parent element of a label group is a tree group
    let newParentTree = null;
    if (this.parentNode) {
      newParentTree = this.parentNode.parentElement;
    }
    const switchingTrees = (newParentTree && newParentTree != elemTree);

    let snapback = false;
    const oldParent = element.__data__.data.parent;
    if (oldParent != "null") {
      const oldParentGroup = this.d3Functions.objects[oldParent].DOMelements.group;
      snapback = oldParentGroup.classList.contains("currentParent");
    }
    const wholeTree = this.elemsToMove.indexOf(elemTree) != -1; // If the tree itself is being moved, its index is NOT -1 because it's in the list
    const leavingTree = (!newParentTree && !snapback && !wholeTree);

    if ((switchingTrees) || leavingTree) {
        element.removeAttribute("onmouseout");
    }
    else {
      // If the element ISN'T about to disappear, just restore its onmouseout attribute.
      element.setAttribute("onmouseout", "app.widget('checkHideButtons', this, event)");
    }

    /* If a child became a root, a root became a child, or a child moved from one tree to another,
     then its DOM element will be removed and replaced. Remove it from the set of selected nodes,
     and add it to a set of objects that should be selected once their new nodes are made.
     This should apply to ALL selected nodes, not just top-level ones.
     Best way I can see to recognize this situation: The element's tree doesn't match the current parent's tree,
     OR there is no current parent but the element has a parent.
     NOTE: This code, as written, will work for all selected nodes, but will sometimes affect children
     that aren't actually moving. That should be acceptable, but if I find a more elegant solution, I'll switch to it.
    */
    for (let group of this.parent.selectedNodes) {
      const DOMtree = group.parentElement; // The parent element of a label group is a tree group
      let newParentTree = null;
      if (this.parentNode) {
        newParentTree = this.parentNode.parentElement;
      }
      const oldParent = group.__data__.data.parent;

      if ((newParentTree && newParentTree != DOMtree) || !newParentTree && oldParent != "null") {
          this.parent.selectedNodes.delete(group);
          const id = group.__data__.data.id;
          const obj = this.d3Functions.objects[id].JSobj;
          this.d3Functions.selectObjectCollection.add(obj);
      }
    }

    for (let object of this.selectedRoots) { // Each object contains a group and a parent group
      // Get object representing the selected label
      const group = object.group;
      const groupID = group.getAttribute("idr").slice(5); // this IDR will be like groupxxx
      const labelObj = this.d3Functions.objects[groupID].JSobj;

      if (this.parentNode) { // If we dropped the selected label onto another label, we should connect them.
        if (labelObj == null) {
          app.error("Could not link two labels because the child object could not be found.");
        }
        else this.dropConnect(this.parentNode, labelObj, object);
      } // end if (the label was dragged onto another label)

      else if (object.parent) { // if the node being dragged was a child, detach it if necessary.
                                // Then refresh the page so it will either snap back or become a new root

        // Detach child if it's too far from parent. Since we're already tracking this with classes, why recalculate?
        if (!(object.parent.classList.contains("currentParent"))) {
          const parentID = object.parent.__data__.data.id;
          const parent = this.d3Functions.objects[parentID].JSobj;
          const parentIndex = parent.children.indexOf(labelObj);
          if(parentIndex != -1) {
            parent.children.splice(parentIndex, 1);
          }
          labelObj.parent = "null";

          // Get coordinates of label and store them
          const labelRect = this.d3Functions.objects[groupID].DOMelements.node.getBoundingClientRect();
          const SVGrect = this.SVG_DOM.getBoundingClientRect();
          const viewBox = this.SVG_DOM.getAttribute("viewBox").split(" ");
          labelObj.x = labelRect.x - SVGrect.x + parseInt(viewBox[0]);
          labelObj.y = labelRect.y - SVGrect.y + parseInt(viewBox[1]);
          this.d3Functions.roots.push(labelObj);
        } // end if (current parent doesn't have currentParent class; the element has moved far enough to detach)
      } // end else if (the element has a current parent and wasn't dragged to another label)
      if (object.parent) {
        object.parent.classList.remove("currentParent");
      }
    } // end for (every selected root)

    // This is cleanup code that doesn't need to run every time
    this.d3Functions.update();
    this.nextSibling = null;
    this.prevSibling = null;
    this.selectedRoots = [];
    if (this.parentNode) {
      this.parentNode.classList.remove("parent");
      this.parentNode = null;
    }
  }

  // Creates a link between the node being dragged and the node it was dropped onto. selectedRoot is used
  // only for moving existing labels, and is the object containing a selected label and its parent.
  dropConnect(node, childObj, selectedRoot) {
    // Get object representing parent node (object representing child node was already found)
    const nodeID = node.getAttribute("idr").slice(5); // the IDR will be like groupxxx
    const parentObj = this.d3Functions.objects[nodeID].JSobj;

    if (parentObj && childObj) { // If both objects exist
      const rootIndex = this.d3Functions.roots.indexOf(childObj); // Remove the child from the roots array if it's in there
      if (rootIndex != -1) {
        this.d3Functions.roots.splice(rootIndex, 1);
      }

      // Remove the child from its parent's children array, if it's in there
      if (selectedRoot && selectedRoot.parent) {
        const parentID = selectedRoot.parent.__data__.data.id;
        const parent = this.d3Functions.objects[parentID].JSobj;
        const parentIndex = parent.children.indexOf(childObj);
        if(parentIndex != -1) {
          parent.children.splice(parentIndex, 1);
        }
      }

      // Auto-show parent's children
      if (parentObj._children) {
        parentObj.children = parentObj._children;
        parentObj._children = null;
      }

      // Make the child a child of the parent
      // Get index of next or previous sibling if applicable, and insert there. If no sibling, just push to the end of the children array.
      if (this.prevSibling) {
        const sibID = this.prevSibling.getAttribute("idr").slice(5);
        const prevSibObj = this.d3Functions.objects[sibID].JSobj;
        const siblings = parentObj.children;
        const index = siblings.indexOf(prevSibObj) + 1; // Insert in the NEXT position, to come after the previous sibling
        parentObj.children.splice(index, 0, childObj);
      }

      else if (this.nextSibling) {
        const sibID = this.nextSibling.getAttribute("idr").slice(5);
        const nextSibObj = this.d3Functions.objects[sibID].JSobj;
        const siblings = parentObj.children;
        const index = siblings.indexOf(nextSibObj); // Insert in the PREVIOUS position, to come after the next sibling
        parentObj.children.splice(index, 0, childObj);
      }

      else if (parentObj.children) {
        parentObj.children.push(childObj);
      }

      else {
        parentObj.children = [];
        parentObj.children.push(childObj);
        alert ("The parent object had no children or _children array. A children array has been created.");
      }

      // Make the parent the child's parent and remove the child's coordinates, which are no longer needed
      childObj.parent = parentObj.id;
      delete childObj.x;
      delete childObj.y;
    } // End if (both objects found)
  }

  // Removes red formatting from the label associated with the clicked button and from all descendants.
  // Detaches the label from its parent iff the parent has red formatting.
  // Hides restore button and refreshes the graphic.
  restore(button) {
    const id = button.getAttribute("idr").slice(7); // idr will be like restorexxx
    const obj = this.d3Functions.objects[id].JSobj;
    obj.deleted = false;
    let descendants = [];
    if (obj.children && obj.children.length > 0) {
      descendants = descendants.concat(obj.children);
    }
    if (obj._children && obj._children.length > 0) {
      descendants = descendants.concat(obj._children);
    }

    while (descendants.length > 0) {
      const descendant = descendants.pop();
      descendant.deleted = false;
      if (descendant.children && descendant.children.length > 0) {
        descendants = descendants.concat(descendant.children);
      }
      if (descendant._children && descendant._children.length > 0) {
        descendants = descendants.concat(descendant._children);
      }
    }

    const parentID = obj.parent;
    if (parentID != "null") {
      const parentObj = this.d3Functions.objects[parentID].JSobj;
      if (parentObj.deleted) { // If the parent is deleted, separate this label from the parent.
        const parentIndex = parentObj.children.indexOf(obj);
        if(parentIndex != -1) {
          parentObj.children.splice(parentIndex, 1);
        }
        obj.parent = "null";

        // Get coordinates of label and store them
        const node = this.d3Functions.objects[id].DOMelements.node;
        const labelRect = node.getBoundingClientRect();
        const SVGrect = this.SVG_DOM.getBoundingClientRect();
        const viewBox = this.SVG_DOM.getAttribute("viewBox").split(" ");
        obj.x = labelRect.x - SVGrect.x + parseInt(viewBox[0]);
        obj.y = labelRect.y - SVGrect.y + parseInt(viewBox[1]);
        this.d3Functions.roots.push(obj);

        // Remove mouseout function because this label is about to disappear and be redrawn
        node.removeAttribute("onmouseout");
        button.removeAttribute("onmouseout");
      }
    }
    this.parent.hideEverything(id);
    this.d3Functions.update();
  }
}
