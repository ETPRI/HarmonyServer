class domFunctions {
  constructor() {}

  // Takes a DOM element and an idr to search for within it. Searches through the element's children, then their children
  // and so on, until it finds an element with that idr, and returns that element. Returns null if it finds no such element.
  // If other widgets are nested inside the element passed in, these are NOT searched.
  getChildByIdr(element, idr) {
    const children = Array.from(element.children); // Get the element's children
    while (children.length > 0) {
      const child = children.pop(); // For each child...
      if (child.getAttribute("idr") == idr) {
        return child; // If the idr matches, return the element...
      }
      else if (!child.classList.contains("widget") && child.children.length > 0) { // If the child is not a widget itself, and it has children...
        children.push(...child.children); // add its children to the children array
      }
    }
  	return null; // return null if no idr matches
  }

  // Takes a DOM element as an argument and returns the ID of the widget that element is part of.
  // If the element is part of nested widgets, returns the inner one. If it's not part of any widget,
  // produces an error message and returns null.
  widgetGetId(domElement) {
  	if (domElement.classList.contains("widget")) {
  		// found start of widget
  		return(domElement.getAttribute("id"));
  	}
    else if (domElement.parentElement){ // if the parent element exists - if we haven't gone all the way up the tree looking for a widget
      // call this method recursively, working up the tree until you either find a widget or run out of parents.
  		return(this.widgetGetId(domElement.parentElement));
  	}
    else {
      alert ("Error: Searched for the widget ID of an element which is not in a widget.");
      return null;
    }
  }
}
