class widgetCalendar {
  constructor(callerID, id, name) {
    this.name = name;
    this.calendarID = id;
    this.widgetID = app.idCounter;
    app.widgets[app.idCounter] = this;
    this.calendarDOM = null;
    this.widgetDOM = null;
    this.callerID = callerID;
    this.selectedButton = null;

    this.hourHeight = "30px";
    this.dayWidth = "600px";
    this.labelWidth = "75px";
    this.headerHeight = "50px";
    this.weekWidth = "200px";
    this.monthHeight = "150px";

    this.days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    this.shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    this.months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    this.shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
    // this.daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];

    this.mode = "day";
    this.day = new Date();
    // if (this.isLeapYear(this.day)) {
    //   this.daysInMonth[1] = 29;
    // }
    this.buildHeader();
  }

  buildHeader() {
    if (!this.name) {
      this.name = "Untitled calendar";  // Call it "Untitled calendar" for now - can change later
    }
    const html = app.widgetHeader() + `<b idr="name">${this.name}</b>
                                       <input type="button" idr="backButton" value="<" onclick="app.widget('page', this)">
                                       <input type="button" class="selectedButton" idr="dayButton" value="Day" onclick="app.widget('changeView', this)">
                                       <input type="button" idr="weekButton" value="Week" onclick="app.widget('changeView', this)">
                                       <input type="button" idr="monthButton" value="Month" onclick="app.widget('changeView', this)">
                                       <input type="button" idr="yearButton" value="Year" onclick="app.widget('changeView', this)">
                                       <input type="button" idr="forwardButton" value=">" onclick="app.widget('page', this)">
                                       <input type="button" idr="details" value="Show Details" onclick="app.widget('showDetails', this)">
                                       </div>
                                       <div><table><tr idr="calendarRow"><td id="calendar${this.widgetID}"></td></tr></table></div></div>`;

    const parent = document.getElementById('widgets');
    const caller = document.getElementById(this.callerID); // Find the first existing element in the widgets div
    const newWidget = document.createElement('div'); // create placeholder div
    parent.insertBefore(newWidget, caller); // Insert the new div before the first existing one
    newWidget.outerHTML = html; // replace placeholder with the div that was just written
    this.calendarDOM = document.getElementById(`calendar${this.widgetID}`);
    this.widgetDOM = document.getElementById(`${this.widgetID}`);
    this.widgetDOM.classList.add("resizeable");

    if (app.activeWidget) {
      app.activeWidget.classList.remove("activeWidget");
    }
    app.activeWidget = this.widgetDOM;
    this.widgetDOM.classList.add("activeWidget");

    this.selectedButton = app.domFunctions.getChildByIdr(this.widgetDOM, "dayButton");

    this.buildDay(this.day);
  }

  calendarTemplate(dateString, columns) {
    const calendar = document.createElement('table');
    this.calendarDOM.appendChild(calendar);

    const headerRow = document.createElement('tr');
    const headerCell = document.createElement('th');
    headerCell.colSpan = `${columns}`;
    headerCell.setAttribute("height", this.headerHeight);
    const dateDOM = document.createElement('b');
    const dateText = document.createTextNode(dateString);
    dateDOM.appendChild(dateText);
    dateDOM.style.fontSize = "xx-large";
    headerCell.appendChild(dateDOM);
    headerRow.appendChild(headerCell);
    calendar.appendChild(headerRow);
    return calendar;
  }

  checkToday(day) {
    const now = new Date();
    if (day.getFullYear() == now.getFullYear()
        && day.getMonth() == now.getMonth()
        && day.getDate() == now.getDate()) {  // If the day being tested is the current day
      return true;
    }
    return false;
  }

  changeView(button) {
    if (this.selectedButton) {
      this.selectedButton.classList.remove("selectedButton");
    }
    button.classList.add("selectedButton");
    this.selectedButton = button;

    switch(button.getAttribute("idr")) {
      case "dayButton":
        this.mode = "day";
        break;
      case "weekButton":
        this.mode = "week";
        break;
      case "monthButton":
        this.mode = "month";
        break;
      case "yearButton":
        this.mode = "year";
        break;
    }
    this.refresh();
  }

  buildDay(date) {
    const day = this.days[date.getDay()];
    const month = this.months[date.getMonth()];
    const dateString = `${day}, ${month} ${date.getDate()}, ${date.getFullYear()}`;

    const calendar = this.calendarTemplate(dateString, 2);

    for (let i = 0; i< 24; i++) {
      let time = i % 12;
      if (time == 0)
        time = 12;
      let amPM = "AM";
      if (i > 11)
        amPM = "PM";
      const timeslot = document.createElement("tr");
      const timeLabel = document.createElement("td");
      const timeText = document.createTextNode(`${time}:00 ${amPM}`);
      timeLabel.appendChild(timeText);
      timeLabel.setAttribute("width", this.labelWidth);
      const timeCell = document.createElement("td");
      timeCell.setAttribute("height", this.hourHeight);
      timeCell.setAttribute("width", this.dayWidth);
      timeslot.appendChild(timeLabel);
      timeslot.appendChild(timeCell);
      calendar.appendChild(timeslot);
    }

    const now = new Date();
    if (this.day.getFullYear() == now.getFullYear()
        && this.day.getMonth() == now.getMonth()
        && this.day.getDate() == now.getDate()) {  // If the day being displayed is the current day, display current time on the table...

      const rect = calendar.getBoundingClientRect();
      const minutes_in_day = 60*24;
      const minutes_so_far = now.getHours()*60 + now.getMinutes();
      const minutes_to_go = minutes_in_day - minutes_so_far;
      const pixels_in_table = rect.height - parseInt(this.headerHeight);
      const pixels_above_bottom = pixels_in_table * minutes_to_go / minutes_in_day; // Calculate how far above the bottom of the table the line representing the time should be

      const testCanvas = document.createElement("canvas");  // Then draw the line
      testCanvas.setAttribute("style", `position:relative; bottom:${pixels_above_bottom}px`);
      testCanvas.setAttribute("height", "20");
      testCanvas.setAttribute("width", rect.width);
      this.calendarDOM.appendChild(testCanvas);
      const ctx = testCanvas.getContext("2d");
      ctx.beginPath();
      ctx.lineWidth = "3";
      ctx.strokeStyle = "red";
      ctx.moveTo(0, 0);
      ctx.lineTo(rect.width,0);
      ctx.stroke();
    }
  }

  buildWeek(date) {
    const sunday = new Date(this.day);
    sunday.setDate(sunday.getDate() - sunday.getDay()); // This should give the Sunday of the desired week by basically "backing up" until the day is 0 (representing Sunday)
    const month = this.months[sunday.getMonth()];
    const dateString = `Week of ${month} ${sunday.getDate()}, ${sunday.getFullYear()}`;

    const calendar = this.calendarTemplate(dateString, 8); // Create the table and first row
    const days = document.createElement("tr");
    calendar.appendChild(days);
    const blank = document.createElement("th"); // The row with the days starts with a blank space above the times
    days.appendChild(blank);
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(day.getDate() + i); // Move to the correct day of the week
      const dayString = `${this.shortDays[i]} ${day.getDate()}`;
      const dayText = document.createTextNode(dayString);
      const dayCell = document.createElement("th");
      dayCell.setAttribute("class", "weekDayCell");
      dayCell.setAttribute("width", this.weekWidth);
      dayCell.appendChild(dayText);
      days.appendChild(dayCell);

      if (this.checkToday(day)) {  // If the day being displayed is the current day, adjust its formatting
        dayCell.setAttribute("style", "color:yellow; font-weight:bold");
      }
    }

    for (let i = 0; i< 24; i++) {
      let time = i % 12;
      if (time == 0)
        time = 12;
      let amPM = "AM";
      if (i > 11)
        amPM = "PM";
      const timeslot = document.createElement("tr");
      const timeLabel = document.createElement("td");
      const timeText = document.createTextNode(`${time}:00 ${amPM}`);
      timeLabel.appendChild(timeText);
      timeLabel.setAttribute("width", this.labelWidth);
      timeslot.appendChild(timeLabel);

      for (let j = 0; j < 7; j++) {
        const timeCell = document.createElement("td");
        timeCell.setAttribute("height", this.hourHeight);
        timeCell.setAttribute("width", this.weekWidth);
        timeslot.appendChild(timeCell);
      }
      calendar.appendChild(timeslot);
    }
  }

  buildMonth(date) {
    const dateString = `${this.months[date.getMonth()]} ${date.getFullYear()}`;
    const calendar = this.calendarTemplate(dateString, 7);
    calendar.setAttribute("class", "month");
    this.displayMonth(date, calendar);
  }

  displayMonth(date, table) {
    const currentDay = new Date(date);
    currentDay.setDate(1);
    currentDay.setDate(1 - currentDay.getDay()); // Get the day to start on - the Sunday of the week when the month starts
    // Create a header row with days of the week
    const header = document.createElement("tr");
    table.appendChild(header);
    for (let i = 0; i<7; i++) {
      const day = document.createElement("th");
      const dayName = document.createTextNode(this.shortDays[i]);
      day.appendChild(dayName);
      header.appendChild(day);
    }

    for (let i = 0; i < 6; i++) { // add a week
      const row = document.createElement("tr");
      table.appendChild(row);
      for (let j = 0; j < 7; j++) { // add a day
        const day = document.createElement("td");
        const dayNum = document.createTextNode(currentDay.getDate());
        day.appendChild(dayNum);

        //formatting
        if (currentDay.getMonth() != date.getMonth()) { // If the day being displayed isn't part of this month
          day.setAttribute("class", "wrongMonth");
        }
        else if (this.checkToday(currentDay)) { // I don't think we should highlight today if we're not even looking at this month.
          day.setAttribute("class", "today");
        }

       //update the day
        currentDay.setDate(currentDay.getDate() + 1);
        row.appendChild(day);
      }
    }
  }

  buildYear(date) {
    const calendar = this.calendarTemplate(date.getFullYear(), 4);
    for (let i = 0; i < 3; i++) { // build a row of months
      const monthRow = document.createElement("tr");
      calendar.appendChild(monthRow);
      for (let j = 0; j < 4; j++) { // build a month
        const monthCell = document.createElement("td");
        monthRow.appendChild(monthCell);
        const monthTable = document.createElement("table");
        monthCell.appendChild(monthTable);
        monthTable.setAttribute("class", "year");

        const monthDate = new Date(date);
        monthDate.setMonth(i*4 + j); // calculate the month to be displayed

        const header = document.createElement("tr"); // Create a header with the name of the month
        const headerCell = document.createElement("th");
        headerCell.setAttribute("colspan", "7");
        headerCell.setAttribute("style", "font-size: large");
        const headerText = document.createTextNode(this.months[i*4 + j]);
        headerCell.appendChild(headerText);
        header.appendChild(headerCell);
        monthTable.appendChild(header);

        this.displayMonth(monthDate, monthTable);
      }
    }
  }

  page(button) {
    let offset = 0;
    if (button.getAttribute("idr") == "backButton") {
      offset = -1; // Add -1 to the day, month or year to go back (or add -7 to the day to go back a week)
    }
    else if (button.getAttribute("idr") == "forwardButton") {
      offset = 1; // Add 1 to the day, month or year to go forward (or add 7 to the day to go forward a week)
    }
    else alert (`Error: something other than the forward or back buttons called the "page" method.`);

    if (this.mode == "day") {
      this.day.setDate(this.day.getDate() + offset);
    }
    else if (this.mode == "week") {
      this.day.setDate(this.day.getDate() + offset*7);
    }
    else if (this.mode == "month") {
      const oldMonth = this.day.getMonth();
      let newMonth = oldMonth + offset; // Get the month we SHOULD end up in
      if (newMonth < 0) newMonth += 12;
      if (newMonth > 11) newMonth -= 12;
      this.day.setMonth(this.day.getMonth() + offset);
      while (this.day.getMonth() != newMonth) { // If we ended up in the wrong month, it's got to be because of overshooting the end (say, because we tried to go to Feb. 30 and ended up in March),
        this.day.setDate(this.day.getDate()-1); // so back up until you reach the last day of the right month
      }
    }
    else if (this.mode == "year") {
      this.day.setFullYear(this.day.getFullYear() + offset);
    }

    // after resetting this.day, refresh the widget
    this.refresh();
  }

  refresh() {
    while (this.calendarDOM.lastChild) { // Clear whatever is already in the calendar
      this.calendarDOM.removeChild(this.calendarDOM.lastChild);
    }

    switch (this.mode) { // Call the "build" method for the current mode
      case "day":
        this.buildDay(this.day);
        break;
      case "week":
        this.buildWeek(this.day);
        break;
      case "month":
        this.buildMonth(this.day);
        break;
      case "year":
        this.buildYear(this.day);
        break;
      default:
        alert(`Error: ${this.mode} is not a valid calendar mode (should be day, week, month or year)`);
    }
  }

  showDetails(button) {
    const row = app.domFunctions.getChildByIdr(this.widgetDOM, 'calendarRow');
    const detailsCell = row.insertCell(-1);
    new widgetDetails('calendar', detailsCell, this.calendarID);
    button.value = "Hide Details";
    button.setAttribute("onclick", "app.widget('hideDetails', this)");
  }

  hideDetails(button) {
    const row = app.domFunctions.getChildByIdr(this.widgetDOM, 'calendarRow');
    row.deleteCell(-1);
    button.value = "Show Details";
    button.setAttribute("onclick", "app.widget('showDetails', this)");
  }
}
