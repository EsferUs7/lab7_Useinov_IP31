const work = document.getElementById('work');
const anim = document.getElementById('anim');
const playButton = document.getElementById('play');
const closeButton = document.getElementById('close');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const reloadButton = document.getElementById('reload');
const log = document.getElementById('log');

let square;
let interval;
let eventCount = 0;
let x, y, deltaX, deltaY, A, alpha, outOfArea;
let sessionID;

function initializeSession() {
    const lastSessionID = parseInt(localStorage.getItem('lastSessionID')) || 0;
    sessionID = lastSessionID + 1;
    localStorage.setItem('lastSessionID', sessionID);
}

function logEvent(message) {
    console.log(message);
    eventCount++;
    const time = new Date().toISOString();
    const logEntry = `[${eventCount}] ${time}: ${message}`;
    log.innerHTML += `<div>${logEntry}</div>`;
    const eventData = {
        id: eventCount,
        event_number: eventCount,
        session_id: sessionID,
        time: time,
        message: message
    };
    console.log(eventData);
    sendEventToServer(eventData);
    const events = JSON.parse(localStorage.getItem('events')) || [];
    events.push(eventData);
    localStorage.setItem('events', JSON.stringify(events));
}

function clearLog() {
    log.innerHTML = '';
    eventCount = 0;
}

function startAnimation() {
    if (!square) {
        square = document.createElement('div');
        square.className = 'square';
        anim.appendChild(square);
        square.style.top = '0';
        square.style.right = '0';
        outOfArea = false;
        const minAngle = Math.PI / 6;
        const maxAngle = Math.PI / 3;
        alpha = Math.random() * (maxAngle - minAngle) + minAngle;
        A = 10;
        x = anim.clientWidth - 10;
        y = 0;
        deltaX = -A * Math.sin(alpha);
        deltaY = A * Math.cos(alpha);
    }

    interval = setInterval(() => {
        x += deltaX;
        y += deltaY;
        if ((y + 10 >= anim.clientHeight || y <= 0) && !outOfArea) {
            deltaY *= -1;
            logEvent('Square hit horizontal wall');
        }
        if (x + 20 < 0 && !outOfArea) {
            stopButton.style.display = 'none';
            reloadButton.style.display = 'inline';
            logEvent('Square exited anim area');
            outOfArea = true;
        }
        square.style.right = `${anim.clientWidth - x - 10}px`;
        square.style.top = `${y}px`;
        logEvent('Square moved');
    }, 50);
    logEvent('Animation started');
}

function stopAnimation(doLog=true) {
    clearInterval(interval);
    if (!doLog) return
    logEvent('Animation stopped');
}

playButton.addEventListener('click', () => {
    initializeSession();
    work.style.display = 'block';
    clearLog();
    logEvent('Work field displayed');
});

function sleep(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {}
}

closeButton.addEventListener('click', async () => {
    stopButton.style.display = 'none';
    reloadButton.style.display = 'none';
    startButton.style.display = 'inline';
    work.style.display = 'none';
    logEvent('Work field closed');
    sleep(200);
    stopButton.style.display = 'none';
    startButton.style.display = 'inline';
    const events = JSON.parse(localStorage.getItem('events')) || [];
    console.table(events.filter(event => event.sessionID === sessionID));
    if (square) {
        square.remove();
        square = null;
    }
    stopAnimation(false);
    const sessionEvents = events.filter(event => event.session_id === sessionID);
    sendEventsToServer();
    const serverEvents = await fetch(`/get_events/${sessionID}`)
        .then(response => response.json())
        .catch(err => {
            console.error('Error fetching server events:', err);
            return [];
        });
    displaySessionTable(sessionEvents, serverEvents);
    const allEvents = await fetch(`/get_all_events/${sessionID}`)
        .then(response => response.json())
        .catch(err => {
            console.error('Error fetching events:', err);
            return [];
        });
    compareEventMethods(allEvents.events);
});

startButton.addEventListener('click', () => {
    startAnimation();
    startButton.style.display = 'none';
    stopButton.style.display = 'inline';
});

stopButton.addEventListener('click', () => {
    stopAnimation();
    stopButton.style.display = 'none';
    startButton.style.display = 'inline';
});

reloadButton.addEventListener('click', () => {
    stopAnimation();
    square.remove();
    square = null;
    startButton.style.display = 'inline';
    stopButton.style.display = 'none';
    reloadButton.style.display = 'none';
    logEvent('Square reloaded');
});


function sendEventToServer(event) {
    fetch('/log_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_id: sessionID,
            event_number: event.id,
            time: event.time,
            message: event.message
        })
    })
    .then(response => response.json())
    .then(data => console.log(`Server time: ${data.server_time}, Event time: ${event.time}`))
    .catch(err => console.error('Error sending event:', err));
}

function sendEventsToServer() {
    const allEvents = JSON.parse(localStorage.getItem('events')) || [];
    const filteredEvents = allEvents.filter(event => event.session_id === sessionID);
    if (filteredEvents.length === 0) {
        console.log("No events to send for the current session.");
        return;
    }
    fetch('/log_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: filteredEvents })
    })
    .then(response => response.json())
    .then(data => console.log(data.message))
    .catch(err => console.error('Error sending events:', err));
    
    console.log("filteredEvents");
    console.log(filteredEvents);
}


function displaySessionTable(localEvents, serverEvents) {
    const tableContainer = document.getElementById('table-container');
    tableContainer.innerHTML = '';
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <th>LocalStorage Data</th>
        <th>Server Data</th>
    `;
    table.appendChild(headerRow);

    const maxLength = Math.max(localEvents.length, serverEvents.length);
    for (let i = 0; i < maxLength; i++) {
        const localEvent = localEvents[i] || { event_number: '', time: '', message: '' };
        const serverEvent = serverEvents[i] || { event_number: '', time: '', message: '' };

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <b>Event #${localEvent.event_number || 'NONE'}</b><br>
                Time: ${localEvent.time || 'NONE'}<br>
                Message: ${localEvent.message || 'NONE'}
            </td>
            <td>
                <b>Event #${serverEvent.event_number || 'NONE'}</b><br>
                Time: ${serverEvent.time || 'NONE'}<br>
                Server saved time: ${serverEvent.server_time || 'NONE'}<br>
                Message: ${serverEvent.message || 'NONE'}
            </td>
        `;
        table.appendChild(row);
    }

    tableContainer.appendChild(table);
}

function compareEventMethods(events) {
    let firstMethodEvents = [];
    let secondMethodEvents = [];
    events.forEach(event => {
        if (event.received_method === 'first')
            firstMethodEvents.push(event);
        else
            secondMethodEvents.push(event);
    });
    console.log("=== Events saved using the first method ===");
    firstMethodEvents.forEach(event => {
        console.log(`Event #${event.event_number} - ${event.message}`);
        console.log(`Client Time: ${event.time}`);
        console.log(`Server Time: ${event.server_time}`);
        console.log("---");
    });
    console.log("=== Events saved using the second method ===");
    secondMethodEvents.forEach(event => {
        console.log(`Event #${event.event_number} - ${event.message}`);
        console.log(`Client Time: ${event.time}`);
        console.log(`Server Time: ${event.server_time}`);
        console.log("---");
    });
}

