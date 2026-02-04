document.addEventListener('DOMContentLoaded', async function() {
    var calendarEl = document.getElementById('calendar');

    // 1. Définition de tes sources avec leurs couleurs respectives
    const sources = [
        { url: "https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=26389&projectId=4&calType=ical&nbWeeks=28&daysBefore=60", color: "#4A90E2" }, 
        { url: "https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=17816&projectId=4&calType=ical&nbWeeks=28&daysBefore=60", color: "#50C878" }, 
        { url: "https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=47289&projectId=4&calType=ical&nbWeeks=28&daysBefore=60", color: "#c85050" }
    ];

    async function fetchAllEvents() {
        const proxy = "https://corsproxy.io/?";
        const allEvents = [];
        const seenUids = new Set();

        for (let source of sources) {
            try {
                const response = await fetch(proxy + encodeURIComponent(source.url));
                const icsData = await response.text();
                
                const jcalData = ICAL.parse(icsData);
                const comp = new ICAL.Component(jcalData);
                const vevents = comp.getAllSubcomponents('vevent');

                vevents.forEach(vevent => {
                    const event = new ICAL.Event(vevent);
                    const uid = event.uid;
                    console.log("Détails du cours :", vevent.toString());
                    if (!seenUids.has(uid)) {
                        seenUids.add(uid);
                        allEvents.push({
                            id: uid,
                            title: event.summary,
                            start: event.startDate.toJSDate(),
                            end: event.endDate.toJSDate(),
                            location: event.location || '', // On récupère la salle
                            backgroundColor: source.color, // On applique la couleur de la source
                            borderColor: source.color
                        });
                    }
                });
            } catch (error) {
                console.error("Erreur sur un lien :", error);
            }
        }
        return allEvents;
    }

    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'fr',
        slotMinTime: '08:00:00',
        slotMaxTime: '19:00:00',
        allDaySlot: false,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,dayGridMonth'
        },
        
        // --- AFFICHAGE DE LA SALLE ---
        eventContent: function(arg) {
            let titleEl = document.createElement('div');
            titleEl.innerHTML = `<b>${arg.event.title}</b>`;
            titleEl.style.fontSize = '0.85em';

            let locationEl = document.createElement('div');
            // Si une salle existe, on l'affiche en petit
            if (arg.event.extendedProps.location) {
                locationEl.innerHTML = `📍 ${arg.event.extendedProps.location}`;
                locationEl.style.fontSize = '0.75em';
                locationEl.style.marginTop = '2px';
            }

            return { domNodes: [titleEl, locationEl] };
        },

        events: async function(info, successCallback, failureCallback) {
            const cleanEvents = await fetchAllEvents();
            successCallback(cleanEvents);
        }
    });

    calendar.render();
});