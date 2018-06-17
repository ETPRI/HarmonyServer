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
  this.queryObjects    = {};  this.queryObjectsInit();            // currently 4 querys
  this.queryObj        = this.queryObjects[nameQueryObject];  // select one query
  this.fields          = this.queryObj.fields;
  this.tableName = nameQueryObject;
  this.dropdownId = id;
  this.widgetID = app.idCounter;

  this.db        = new db();   // create object to make query
  this.db.setQuery(this.queryObj.query);
  this.queryData = {};                       // where returned data will be stored

  // runQuery is asynchronous - it will read data in the background and call the method "queryComplete" when done
  this.db.runQuery(this,"queryComplete");         // make query, when done run method queryComplete
}


// this.db has finished building data
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

  if (app.activeWidget) {
    app.activeWidget.classList.remove("activeWidget");
  }
  app.activeWidget = document.getElementById(this.widgetID);
  document.getElementById(this.widgetID).classList.add("activeWidget");

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


////////////////////////////////////////////////////////////////////
buildHeader() {
  // build header

  const html =app.widgetHeader() +'<b> '+ this.tableName +` </b></div>

  <table>
    <thead>#header#</thead>
    <tbody>#data#</tbody>
  </table>
  </div>
  `

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
      // html += '<td ' + this.getatt(fieldName) +'>'+ r[i][fieldName] +"</td>" ;
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

  return (ret);
}


// init date from metadata db query
queryObjectsInit() {

this.queryObjects.nodes = {
  nameTable: "nodes"
  // DBREPLACE DB function: changeNode
  // JSON object: {name:"n"}
  // Won't do the unwinding or collecting - that will have to be done in program
  ,query: "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L) as count"
  ,fields: {
  	"L":       {label: "Labels"} // Removed ", att: 'onclick="app.widgetNewClick(this)"'"
   ,"count":  {label: "Count"  }
  }}

this.queryObjects.keysNode = {
   nameQuery: ""
   // DBREPLACE DB function: changeNode
   // JSON object: {name:"p"}
   // Won't do the unwinding or collecting - that will have to be done in program
  ,query: "MATCH (p) unwind keys(p) as key RETURN  distinct key, labels(p) as label,  count(key) as count  order by key"
  ,fields: {
  		"key":     {label: "Key"   , comment: "like fields"}
  	 ,"label":   {label: "Node"  , comment: "Like a table in RDBS"}
  	 ,"count":   {label: "Count" , comment: ""}
   }}

this.queryObjects.relations = {
	nameTable: "relations"
  // DBREPLACE DB function: changePattern
  // JSON object: {nodesFind:[{name:"a"}, {name:"b"}]; relsFind:[{name:"r"; from:"a"; to:"b"}]}
  // Won't do the unwinding or collecting - that will have to be done in program
	,query: "MATCH (a)-[r]->(b)  return distinct labels(a), type(r), labels(b), count(r)  order by type(r)"
	,fields: {
		"labels(a)":  {label: "Node"        , comment: "Like a table in RDBS"}
	 ,"type(r)":    {label: "-Relation->" , comment: "like fields"}
	 ,"labels(b)":  {label: "Node"        , comment: ""}
	 ,"count(r)":   {label: "Count"       , comment: ""}
	}}

this.queryObjects.keysRelation = {
   nameTable: "keys"
   // DBREPLACE DB function: changeRelation
   // JSON object: {name:"r"}
   // Won't do the unwinding or collecting - that will have to be done in program
  ,query: "match ()-[r]->() unwind keys(r) as key return distinct key, type(r), count(key) as count"
  ,fields: {
  		"key":     {label: "Key"          , comment: "like fields"}
  	 ,"type(r)": {label: "-Relation->"  , comment: "Like a table in RDBS"}
  	 ,"count":   {label: "Count"        , comment: ""}
   }}


this.queryObjects.myTrash = {
   nameTable: "myTrash"
   // DBREPLACE DB function: changePattern
   // JSON object: {nodesFind:[{name:"user"; ID:app.login.userID},
   //                          {name:"node"}];
   //                relsFind:[{name:"rel"; type:"Trash"; from:"user"; to:"node"}]}
   ,query: `match (user)-[rel:Trash]->(node) where ID(user)=${app.login.userID} return id(node) as id, node.name as name, labels(node) as labels, rel.reason as reason, node`
   ,fields: {
       "id":     {label: "ID",   att: `onclick="app.widget('edit',this)"`}
     ,"name":   {label:"Name"}
   	 ,"labels": {label: "Labels"}
   	 ,"reason":  {label: "Reason"}
    }}

this.queryObjects.allTrash = {
   nameTable: "allTrash"
   // DBREPLACE DB function: changePattern
   // JSON object: {nodesFind:[{name:"node"}]; relsFind:[{name:"rel"; to:"node"}]}
   ,query: `match ()-[rel:Trash]->(node) return ID(node) as id, node.name as name, count(rel) as times`
   ,fields: {
       "id":     {label: "ID",   att: `onclick="app.widget('showReasons',this)"`}
     ,"name":   {label:"Name"}
   	 ,"times": {label: "Times trashed"}
    }}
} /// end method

edit(element){
  const id = element.innerHTML;
  new widgetNode(this.widgetID, element.nextElementSibling.nextElementSibling.innerText, id);

  const obj={};
  obj.id=app.domFunctions.widgetGetId(element);
  obj.idr=element.getAttribute("idr");
  obj.action="click";
  app.regression.log(JSON.stringify(obj));
  app.regression.record(obj);
}

showReasons(element) {
  const id = element.innerHTML;
  // DBREPLACE DB function: changePattern
  // JSON object:{nodesFind:[{name:"user"}, {name:"node"; ID:id}];
  //              relsFind:[{name:"rel"; type:"Trash"; from:"user"; to:"node"}]}
  const query = `match (user)-[rel:Trash]->(node) where ID(node) = ${id} return user.name as userName, ID(user) as userID, rel.reason as reason, node.name as nodeName, ID(node) as nodeID`;
  this.db.setQuery(query);
  this.db.runQuery(this, "buildReasons");
}

buildReasons(data) {
  if (data) { // assuming some trash relations were found
    let html = app.widgetHeader();
    html += `<table><thead>
    <tr><th colspan=3>${data[0].nodeName} (node#${data[0].nodeID})</th></tr>
    <tr><th>UserID</th><th>User Name</th><th>Reason for trashing</th></tr></thead><tbody>`

    for (let i=0; i<data.length; i++) {
      html += `<tr><td>${data[i].userID}</td><td>${data[i].userName}</td><td>${data[i].reason}</td></tr>`
    }

    html+='</tbody></table></div>';

    // add
    const parent = document.getElementById('widgets');
    const child = parent.firstElementChild;
    const newWidget = document.createElement('div'); // create placeholder div
    parent.insertBefore(newWidget, child); // Insert the new div before the first existing one
    newWidget.outerHTML = html; // replace placeholder with the div that was just written
  }
}
} ////////////////////////////////////////////////// end class
