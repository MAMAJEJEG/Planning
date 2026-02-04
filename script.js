//Connexion à la base de donnée
// const SUPABASE_URL = 'https://ugiaamkufvppfxamvnuj.supabase.co';
// const SUPABASE_KEY = 'sb_publishable_aDnK_u5IuYNTiQPRH8E-Yw_6Z8Ay5BK';

// const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

document.addEventListener('DOMContentLoaded', async function() {

    // console.log("Connexion Supabase initialisée :", sb);

    // async function testBase() {
    //     const { data, error } = await sb.from('cours').select('*').limit(1);
    //     if (error) {
    //         console.error("Erreur de connexion à la base :", error.message);
    //     } else {
    //         console.log("Connexion réussie ! Données reçues :", data);
    //     }
    // }

    // testBase();

    const toggleBtn = document.getElementById('toggle-edit-btn');
    
    let isEditMode = false; // État initial


    var calendarEl = document.getElementById('calendar');

    // 1. Définition de tes sources avec leurs couleurs respectives
    const ICAL_SOURCES = [
        { url: "https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=26389&projectId=4&calType=ical&nbWeeks=28&daysBefore=60", color: "#4A90E2" }, 
        { url: "https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=17816&projectId=4&calType=ical&nbWeeks=28&daysBefore=60", color: "#50C878" }, 
        { url: "https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=47289&projectId=4&calType=ical&nbWeeks=28&daysBefore=60", color: "#c85050" }
    ];

    // --- 2. GESTION DU STOCKAGE ---
    function getStoredEvents() {
        const data = localStorage.getItem('mon_planning_data');
        return data ? JSON.parse(data) : {};
    }

    function saveEvents(eventsObj) {
        localStorage.setItem('mon_planning_data', JSON.stringify(eventsObj));
    }


   async function syncIcalToStorage() {
        const proxy = "https://corsproxy.io/?";
        let storedEvents = getStoredEvents();
        const seenUidsInThisSync = new Set(); 

        for (let source of ICAL_SOURCES) {
            try {
                const response = await fetch(proxy + encodeURIComponent(source.url));
                const icsData = await response.text();
                const jcalData = ICAL.parse(icsData);
                const comp = new ICAL.Component(jcalData);
                const vevents = comp.getAllSubcomponents('vevent');

                vevents.forEach(vevent => {
                    const event = new ICAL.Event(vevent);
                    const uid = event.uid;

                    // On évite les doublons entre les flux
                    if (seenUidsInThisSync.has(uid)) return;
                    seenUidsInThisSync.add(uid);

                    // On ne met à jour QUE si l'événement n'est pas marqué comme "modifié par l'utilisateur"
                    if (!storedEvents[uid] || !storedEvents[uid].manuallyModified) {
                        const descLines = (event.description || '').split('\n').map(l => l.trim()).filter(l => l !== "");
                        
                        storedEvents[uid] = {
                            id: uid,
                            title: event.summary,
                            start: event.startDate.toJSDate().toISOString(),
                            end: event.endDate.toJSDate().toISOString(),
                            location: event.location || 'N/A',
                            prof: descLines[1] || '',
                            backgroundColor: source.color,
                            borderColor: source.color,
                            manuallyModified: false // Flag pour ne pas écraser tes futurs changements
                        };
                    }
                });
            } catch (err) {
                console.error("Erreur sur un flux iCal :", err);
            }
        }
        saveEvents(storedEvents);
    }

    let currentEditingEvent = null; // Stocke l'événement en cours (création ou modif)
    let selectedColor = "#3498db";  // Couleur par défaut

    const modal = document.getElementById('modal-overlay');
    const titleInput = document.getElementById('event-title-input');
    const deleteBtn = document.getElementById('btn-delete');
    function closeModal() {
        modal.style.display = 'none';
        currentEditingEvent = null;
    }

    // --- Gestion de la sélection de couleur (Pastilles) ---
    document.querySelectorAll('.color-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            selectedColor = opt.getAttribute('data-color');
            document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });


    // Fonction pour ouvrir la modale
    function openModal(info, isNew = false) {
        currentEditingEvent = info;
        const saveBtn = document.getElementById('btn-save');
        const deleteBtn = document.getElementById('btn-delete');
        const colorSection = document.querySelector('.color-picker');
        const colorLabel = document.getElementById('event-color-label'); // On cible le label
        const modalTitle = document.getElementById('modal-title-head');

        const title = isNew ? "" : info.event.title;
        titleInput.value = title;

        if (!isEditMode && !isNew) {
            // --- MODE LECTURE ---
            modalTitle.innerText = "Détails de l'événement";
            titleInput.disabled = true;
            saveBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
            
            // On cache le label ET les pastilles
            colorLabel.style.display = 'none';
            colorSection.style.display = 'none';
            
            document.getElementById('btn-cancel').innerText = "Fermer";
        } else {
            // --- MODE ÉDITION ---
            modalTitle.innerText = isNew ? "Nouvel événement" : "Modifier l'événement'";
            titleInput.disabled = false;
            saveBtn.style.display = 'block';
            deleteBtn.style.display = isNew ? 'none' : 'block';
            
            // On réaffiche tout proprement
            colorLabel.style.display = 'block';
            colorSection.style.display = 'flex';
            
            document.getElementById('btn-cancel').innerText = "Annuler";
            selectedColor = isNew ? "#3498db" : info.event.backgroundColor;
        }

        modal.style.display = 'flex';
    }

    // Bouton Annuler
    document.getElementById('btn-cancel').addEventListener('click', closeModal);

    // Bouton Enregistrer
    document.getElementById('btn-save').addEventListener('click', () => {
        let storedEvents = getStoredEvents();
        let id, start, end;

        if (currentEditingEvent.event) { // Cas d'une modification
            id = currentEditingEvent.event.id;
            start = currentEditingEvent.event.startStr;
            end = currentEditingEvent.event.endStr;
        } else { // Cas d'une création (select)
            id = 'perso-' + Date.now();
            start = currentEditingEvent.startStr;
            end = currentEditingEvent.endStr;
        }

        storedEvents[id] = {
            id: id,
            title: titleInput.value || "Sans titre",
            start: start,
            end: end,
            backgroundColor: selectedColor,
            borderColor: selectedColor,
            manuallyModified: true,
            location: currentEditingEvent.event ? currentEditingEvent.event.extendedProps.location : 'Perso'
        };

        saveEvents(storedEvents);
        calendar.refetchEvents(); // Rafraîchir le calendrier
        closeModal();
    });

    // Bouton Supprimer
    deleteBtn.addEventListener('click', () => {
        if (currentEditingEvent && currentEditingEvent.event) {
            let storedEvents = getStoredEvents();
            delete storedEvents[currentEditingEvent.event.id];
            saveEvents(storedEvents);
            calendar.refetchEvents();
            closeModal();
        }
    });

  // --- 4. INITIALISATION DU CALENDRIER ---
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'fr',
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        allDaySlot: false,
        
        // On démarre en "Lecture Seule"
        editable: false, 
        selectable: false,
        
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,dayGridMonth'
        },

        events: async function(info, successCallback) {
            await syncIcalToStorage();
            const events = Object.values(getStoredEvents());
            successCallback(events);
        },

        // --- GESTION DU BOUTON DE MODIFICATION ---
        // --- GESTION DE LA CRÉATION ---
        select: function(info) {
            if (isEditMode) {
                openModal(info, true); // Ouvre la modale en mode "Nouveau"
            }
            calendar.unselect();
        },

        // --- GESTION DU CLIC SUR UN ÉVÉNEMENT ---
        eventClick: function(info) {
            // On ouvre la modale systématiquement, que l'on soit en édition ou non
            openModal(info, false);
        },

        eventDrop: function(info) {
            // Cette fonction ne s'exécutera que si editable est true
            let storedEvents = getStoredEvents();
            if (storedEvents[info.event.id]) {
                storedEvents[info.event.id].start = info.event.start.toISOString();
                storedEvents[info.event.id].end = info.event.end.toISOString();
                storedEvents[info.event.id].manuallyModified = true;
                saveEvents(storedEvents);
            }
        },

        eventContent: function(arg) {
            let container = document.createElement('div');
            container.innerHTML = `
                <div style="font-weight:bold; font-size:0.85em;">${arg.event.title}</div>
                <div style="font-size:0.75em;">📍 ${arg.event.extendedProps.location || ''}</div>
            `;
            return { domNodes: [container] };
        },

      
    });

    // --- LOGIQUE DU BOUTON ---
    toggleBtn.addEventListener('click', function() {
        isEditMode = !isEditMode; // Inverse l'état
        
        if (isEditMode) {
            // Activer le mode édition
            calendar.setOption('editable', true);
            calendar.setOption('selectable', true);
            toggleBtn.innerHTML = "Mode Édition 🔓";
            toggleBtn.className = "btn-edit";
            document.body.classList.add('editing-active');
        } else {
            // Désactiver le mode édition
            calendar.setOption('editable', false);
            calendar.setOption('selectable', false);
            toggleBtn.innerHTML = "Mode Lecture 🔒";
            toggleBtn.className = "btn-read";
            document.body.classList.remove('editing-active');
        }
    });

    calendar.render();
});