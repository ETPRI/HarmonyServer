/*
widgetTableQuery

display a cypher query in a table, used mainly for meta data reporting

*/

////////////////////////////////////////////////////////////////////  class start
class widgetTableQuery {
constructor (nameQueryObject, id) {
  // init instance variables
  this.html            = ""; // will contain html that makes up widget
  this.queryObjectName = nameQueryObject;  // key to select queryObj
  this.queryObjects    = {};
  this.queryObjectsInit();            // currently 4 querys
  this.queryObj        = this.queryObjects[nameQueryObject];  // select one query
  this.queryData       = null;
  this.fields          = this.queryObj.fields;
  this.dropdownId      = id;
  this.widgetID        = app.idCounter;
  this.widgetDOM       = null;
  this.requests        = [];

  const userRequest = app.REST.startUserRequest("Searching for metadata", this.widgetDOM);

  app.REST.sendQuery(nameQueryObject, "getMetaData", "Searching for metadata", userRequest, this.widgetDOM, null, null, this.queryComplete.bind(this));
}

queryComplete(data) {
  this.queryData = data ;
  this.buildHeader();  // add to this.html
  this.buildData();    // add to this.html

  // add
  const parent = document.getElementById('widgets');
  const child = parent.firstElementChild;
  const newWidget = document.createElement('div'); // create placeholder div
  parent.insertBefore(newWidget, child); // Insert the new div before the first existing one
  newWidget.outerHTML = this.html; // replace placeholder with the div that was just written
  this.widgetDOM = document.getElementById(this.widgetID);


  const widgetList = document.getElementById("widgetList"); // Get the list of widgets
  const newEntry = document.createElement("li"); // Create an entry for the new widget
  widgetList.insertBefore(newEntry, widgetList.firstElementChild);

  // Set up the new widget's entry - it should describe the widget for now, and later we'll add listeners
  newEntry.outerHTML = `<li onclick="app.clickWidgetEntry(this)" draggable="true" ondragstart="app.drag(this, event)"
  ondragover="event.preventDefault()" ondrop="app.drop(this, event)" idr="${this.widgetID}">
  Metadata query: <span idr="name">${this.queryObjectName}</span></li>`;

  if (app.activeWidget) {
    app.activeWidget.classList.remove("activeWidget");
  }
  app.activeWidget = document.getElementById(this.widgetID);
  document.getElementById(this.widgetID).classList.add("activeWidget");

  if (app.regression) {
    // log
    const obj = {};
    obj.id = this.dropdownId;
    obj.value = this.queryObjectName;
    obj.action = "click";
    obj.data = data;
    app.stripIDs(obj.data);

    // I want to do this part here, rather than adding it to stripIDs, because while a NODE's "identity" field is pretty much always going to be its Neo4j ID,
    // I worry that a field we specifically asked to have returned, and which we happened to name "ID", might at some point be something we want to record.
    // I think that may be better to remove on a case-by-case basis.
    for (let i = 0; i < obj.data.length; i++) {
      if ('id' in obj.data[i]) {
        delete obj.data[i].id;
      }
    }
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }
}

////////////////////////////////////////////////////////////////////
buildHeader() {
  // build header

  const html = app.widgetHeader('widgetTableQuery') +`<b>${this.queryObjectName}</b></span>
  <input type="button" class="hidden" idr="cancelButton" value="Cancel" onclick="app.stopProgress(this)"></div>

  <table class="widgetBody freezable">
    <thead>#header#</thead>
    <tbody>#data#</tbody>
  </table>
  </div>
  `;

  //  const html2 = app.idReplace(html,1);  // replace relative ids with absolute ides
  const html3 = html.replace("#header#",
  // create html for header
  (function(fields) {
  	// build search part of buildHeader
    const r="<tr>#fields#</tr>"

    // append label part of the header
    let f="";
    for (let propt in fields){
        f += "<th>"+ fields[propt].label + "</th>" ; // Removed onClick='app.widgetSort(this)' for now
  	}
    return r.replace('#fields#',f);
  }) (this.fields)
  )

 this.html = html3;
}

////////////////////////////////////////////////////////////////////
buildData() {
  let html = "";
  const r = this.queryData;  // from the db
  for (let i=0; i<r.length; i++) {
    html += '<tr>'
    for (let fieldName in this.fields) {
      html += `<td ${this.getatt(fieldName)}idr="${fieldName}${i}">${r[i][fieldName]}</td>`;
    }
    html += "</tr>"
  }
  this.html = this.html.replace('#data#',html);
}

/* */
getatt(fieldName){
  let ret = this.fields[fieldName].att
  if (!ret) {
    ret="";
  }

  return ret;
}

// init date from metadata db query
queryObjectsInit() {
  this.queryObjects.nodes = {
    nameTable: "Nodes"
    ,fields: {
    	"L":       {label: "Labels"} // Removed ", att: 'onclick="app.widgetNewClick(this)"'"
     ,"count":  {label: "Count"  }
    }}

  this.queryObjects.keysNode = {
     nameTable: "Node Keys"
    ,fields: {
    		"key":     {label: "Key"   , comment: "like fields"}
    	 ,"label":   {label: "Node"  , comment: "Like a table in RDBS"}
    	 ,"count":   {label: "Count" , comment: ""}
     }}

  this.queryObjects.relations = {
  	nameTable: "Relations"
  	,fields: {
  		"labels(a)":  {label: "Node"        , comment: "Like a table in RDBS"}
  	 ,"type(r)":    {label: "-Relation->" , comment: "like fields"}
  	 ,"labels(b)":  {label: "Node"        , comment: ""}
  	 ,"count":   {label: "Count"       , comment: ""}
  	}}

  this.queryObjects.keysRelation = {
     nameTable: "Relation Keys"
    ,fields: {
    		"key":     {label: "Key"          , comment: "like fields"}
    	 ,"type(r)": {label: "-Relation->"  , comment: "Like a table in RDBS"}
    	 ,"count":   {label: "Count"        , comment: ""}
     }}
} /// end method

// edit(element){
//   const GUID = element.innerHTML;
//   new widgetNode(this.widgetID, element.nextElementSibling.nextElementSibling.innerText, GUID);
//
//   const obj={};
//   obj.id=app.domFunctions.widgetGetId(element);
//   obj.idr=element.getAttribute("idr");
//   obj.action="click";
//   app.regression.log(JSON.stringify(obj));
//   app.regression.record(obj);
// }
//
// showReasons(element) {
//   const GUID = element.innerHTML;
//   const obj = {};
//   obj.from = {"name":"user"};
//   obj.to = {"name":"node", "properties":{"M_GUID":GUID}};
//   obj.rel = {"type":"Trash"};
//
//   const callerID = app.domFunctions.widgetGetId(element);
//
//   const userRequest = app.REST.startUserRequest("Searching for details", this.widgetDOM);
//
//   app.REST.sendQuery(obj, "changeRelation", "Searching for details", userRequest, this.widgetDOM, null, null, this.buildReasons.bind(this), callerID);
// }
//
// buildReasons(data, userRequest, callerID) {
//   if (data) { // assuming some trash relations were found
//     let ID = app.idCounter;
//     let html = app.widgetHeader('trashTable');
//     html += `<table><thead>
//     <tr><th colspan=3>${data[0].node.properties.name} (node#${data[0].node.id})</th></tr>
//     <tr><th>UserID</th><th>User Name</th><th>Reason for trashing</th></tr></thead><tbody>`
//
//     for (let i=0; i<data.length; i++) {
//       html += `<tr><td>${data[i].user.id}</td><td>${data[i].user.properties.name}</td><td>${data[i].rel.properties.reason}</td></tr>`
//     }
//
//     html+='</tbody></table></div>';
//
//     // add
//
//     const parent = document.getElementById('widgets');
//     let caller = document.getElementById(callerID);
//     const newWidget = document.createElement('div'); // create placeholder div
//
//     // I want to insert the new widget before the TOP-LEVEL widget that called it, if that widget is in the widgets div.
//     // The ID passed in is that of the widget that called it, but it may be in another widget. So go up the chain until
//     // either caller's parent is the widgets div (meaning that caller is a top-level widget in the widgets div), or caller
//     // has no parent (meaning that the original caller was NOT in the widgets div, since no ancestor in that div was found).
//     while (caller && caller.parentElement && caller.parentElement !== parent) {
//       caller = caller.parentElement;
//     }
//
//     if (caller && caller.parentElement == parent) { // If the caller (or its parent widget) is, itself, in the widgets div
//       parent.insertBefore(newWidget, caller); // Insert the new div before the caller
//     }
//     else {
//       parent.insertBefore(newWidget, parent.firstElementChild) // Insert the new div at the top of the widgets div
//     }
//
//     newWidget.outerHTML = html; // replace placeholder with the div that was just written
//
//     const widgetList = document.getElementById("widgetList"); // Get the list of widgets
//     let callerEntry = null;
//     if (caller) {
//       callerEntry = app.domFunctions.getChildByIdr(widgetList, caller.getAttribute("id"));
//     } // Find the entry on that list for the caller, assuming the caller and its entry exist
//
//     const newEntry = document.createElement("li"); // Create an entry for the new widget
//     if (callerEntry) { // If the caller's entry exists, the new widget's entry goes above it (like the new widget goes above the caller)
//       widgetList.insertBefore(newEntry, callerEntry);
//     }
//     else { // Otherwise, the new widget's entry goes at the top, like the new widget does
//       widgetList.insertBefore(newEntry, widgetList.firstElementChild);
//     }
//
//     // Set up the new widget's entry - it should describe the widget for now, and later we'll add listeners
//     let name = `Unnamed ${data[0].node.labels[0]} node`;
//     if (app.getProp(data, 0, "node", "properties", "name")) {
//       name = `${data[0].node.properties.name}: ${data[0].node.labels[0]}`;
//     }
//     newEntry.outerHTML = `<li onclick="app.clickWidgetEntry(this)" draggable="true" ondragstart="app.drag(this, event)"
//     ondragover="event.preventDefault()" ondrop="app.drop(this, event)" idr="${ID}">
//     Reasons for trashing node: <span idr="name">${name}</span></li>`;
//   }
// }
} ////////////////////////////////////////////////// end class
