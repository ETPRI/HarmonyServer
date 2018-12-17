class public {
  constructor() {
    this.highlightedDOM = null;
  }

  // Assumes that filename is the name of an HTML file in the appPublic2 folder.
  // Requests the file and plugs its contents into the given DOM element.
  render(DOMelement, filename) {
    // the loginDiv functions as a widget so app.widget can work with it. Over in app, it's also added to the widgets array.
    const xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        DOMelement.innerHTML = this.responseText;
      }
    };

    xhttp.open("GET", `../appPublic2/${filename}.html`);
    xhttp.send();
  }

  // Assumes that filename is the name of an HTML file in the appPublic2/content folder,
  // and that there is a DOM element with the ID "contentDiv".
  // Calls render to request the file and plug it into the contentDiv element.
  // Then calls highlightButton to mark the button representing that file as selected.
  renderContent(filename) {
    const DOMelement = document.getElementById("contentDiv");
    this.render(DOMelement, `content/${filename}`);
    this.highlightButton(filename);
  }

  // Assumes that there is a DOM element with the ID "headerDiv",
  // and that there is a "header.html" file in the appPublic2 folder.
  // Calls render to request the "header.html" file and plug it into the headerDiv element.
  renderHeader() {
    const DOMelement = document.getElementById("headerDiv");
    this.render(DOMelement, "header");
  }

  // Assumes that there is a DOM element with the ID "footerDiv".
  // and that there is a "footer.html" file in the appPublic2 folder.
  // Calls render to request the "footer.html" file and plug it into the footerDiv element.
  renderFooter() {
    const DOMelement = document.getElementById("footerDiv");
    this.render(DOMelement, "footer");
  }

   // Assumes that there is a DOM element with the ID "navDiv", that there is a "nav.html" file in the appPublic2 folder,
   // and that there is a nav.JSON file in the appPublic2 folder. (Detailed assumptions about this are found at buildNavEntry.)
   // The function calls render to request the nav.html file and plug it into the navDiv, then requests the nav.JSON file
   // and repeatedly calls the buildNavEntry function to build up HTML for the list items in the nav bar.
   // Once the HTML for the list is finished, passes it to loadNavBar to plug it into the nav bar.
  renderNav() {
    const DOMelement = document.getElementById("navDiv");
    this.render(DOMelement, "nav");

    const xhttp = new XMLHttpRequest();
    const publicClass = this;

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const navInfo = JSON.parse(this.responseText);

        // Build HTML for navigation header
        let navHTML = "";
        for (let i = 0; i < navInfo.length; i++) {
          navHTML += publicClass.buildNavEntry(navInfo[i]);
        }

        // call function to plug HTML into nav bar container once it exists
        publicClass.loadNavBar(navHTML);
      }
    };

    xhttp.open("GET", `../appPublic2/nav.JSON`);
    xhttp.send();
  }

  // Assumes that either in the main page or nav.HTML, there is a list element (<UL> or <OL>) with the ID "menu-top-nav".
  // Checks whether the element exists (if it's in nav.HTML, it may not have loaded when this first fires).
  // If it doesn't yet exist, waits 100 ms and tries again.
  // Once the element exists, plugs the given HTML (which should be a collection of <LI>s) into it.
  loadNavBar(navHTML) {
    // Check whether the nav container exists - if not, wait 100 ms and try again
    const navBar = document.getElementById("menu-top-nav");
    if (navBar === null) {
      setTimeout(this.loadNavBar.bind(this), 100, navHTML);
      return;
    }
    navBar.innerHTML = navHTML;
  }


  /*
  Assumes that the listItem ofject has the correct structure:
     "name": the name to show on the nav button, if the corresponding nav button should contain text
     "description", "icon": The icon to show, and the description for screen readers, if the nav button should NOT contain text
     "URL": the URL to link to, if the nav button leads to an outside site
     "HTML": the name of the file to link to, if the nav button leads to another webpage on this site
     "children": an array of objects representing submenu items. Each of these can also have a name, description, URL, HTML and children entry
  Ideally, every entry should contain either a name or a description and icon (not both), and either a URL or an HTML (not both).
  If both ARE present, the name and HTML entries take precedence.
  If neither name nor icon is present, the button is blank.
  If neither HTML or URL is present, the link goes nowhere.

  Generates HTML to display this listItem in the nav menu - there's an <LI> wrapping the whole thing,
  followed by an <A> which links to the specified URL or web page.
  The <A> may just contain a text label, or an icon and screen-reader description.
  Then if the item has children, there's a submenu consisting of a toggle button, an <UL> tag, and the HTML resulting
  from calling this function on each child in turn (each one generates the HTML for its own <LI>).
  */
  buildNavEntry(listItem) {
    let HTML = "";

    // Start the LI wrapper for the entry, and assign its class and ID
    if (listItem.name) {
      HTML = `<li id="menu-item-${listItem.name}" class="menu-item">`;
    }
    else {
      HTML = `<li class="menu-item">`;
    }

    // Start the A link and assign its destination
    let link = "#";
    if (listItem.name) {
      link = `href = "javascript:appPublic.renderContent('${listItem.name}');"`;
    }
    else if (listItem.URL) {
      link = `href = "${listItem.URL}" target = "_blank"`;
    }
    HTML += `<a ${link} itemprop="url">`;

    // Create label span inside the A element; close A tag
    let spanContent = "";
    if (listItem.name) {
      spanContent = listItem.name;
    }
    else {
      if (listItem.icon) {
        spanContent += `<i class='icon-2x icon-${listItem.icon}'></i>`;
      }
      if (listItem.description) {
        spanContent += `<span class="fa-hidden">${listItem.description}</span>`;
      }
    }
    HTML += `<span itemprop="name">${spanContent}</span></a>`;

    // If there are children, add a submenu toggle button and a list, and populate it with the children
    if (listItem.children) {
      HTML += `<button class="sub-menu-toggle" aria-expanded="false" aria-pressed="false">
                <span class="screen-reader-text">Submenu</span></button><ul class="sub-menu">`;
      for (let i = 0; i < listItem.children.length; i++) {
        HTML += this.buildNavEntry(listItem.children[i]);
      }
      HTML += "</ul>";
    }

    // Finally, close the LI tag and return the HTML
    HTML += "</li>";
    return HTML;
  }

  /* Transfers the "current-menu-item" class by:
    Removing it from the current highlighted button, if there is any
    Applying it to the button whose ID is "menu-item-" followed by the given filename, if it exists
    Remembering which button, if any, is highlighted for the next time this function is called.
  */
  highlightButton(filename) {
    if (this.highlightedDOM) {
      this.highlightedDOM.classList.remove("current-menu-item");
    }
    const button = document.getElementById(`menu-item-${filename}`);
    if (button) {
      button.classList.add("current-menu-item");
      this.highlightedDOM = button;
    }
  }
}
