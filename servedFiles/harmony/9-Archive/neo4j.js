// init neo4j  - this is going away
/*

input: query strings
output: memory object with returned database

memory objects edited are marked as changed, user see unsaved canges
displayed in a different color, they click save to update the datbase.
They can also view original value before save.

this object would be used inconjuction with a display widget that would render the data to the screen

*/

/* cyper default values if not specifed in the cyper attributes
	 match     = "(n)";
	 where     = "begins with from search fields all anded together";
	 return    = "[list of field keys]";
	 orderBy   = "n.[orderBy Attribute]";
   query is calculated by concating the above values

	 if query is given, then no calcuation is done, and the query is run unaltered
*/

/*

constroctor
get
set
run query


*/

//case - query on tables

app.db.template = {
	// from meta data query,
	nameTable: "people"     //
 ,comment: "each record (node) holds one person"
 ,cypher:   {query: "" orderBy: "nameLast"}  // default cypher query componest
 ,fields: {
		 nameFirst: {label: "First Name", comment: "given name",  att: 'onclick="app.widget.edit(this)"'}
		,nameLast:  {label: "Last Name" , comment: "Sir name",    }
		,email:     {label: "email"     , comment: "primary email"}  // should remove at someponit
	}

  // user can change this while widge is runing
	,columOrder:   ["nameLast", "nameFirst", email]
  ,displayOrder: ["nameLast"]   // sort by

	// data from query
	,data: [
		 {id: "34" ["data", "asdfsd", "sadfs", "asdf"], changed: "true"}
		,{id: "1"  ["data", "asdfsd", "sadfs", "asdf"], }
		,{id: "42" ["data", "asdfsd", "sadfs", "asdf"], }
	]
	}

// case of arbitry query with realtion and node data, and agreated - not to be edited
