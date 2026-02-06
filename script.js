const SUPABASE_URL = 'https://ugiaamkufvppfxamvnuj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aDnK_u5IuYNTiQPRH8E-Yw_6Z8Ay5BK';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log(sb);

document.addEventListener('DOMContentLoaded', async function() {
    const calendarEl = document.getElementById('calendar');
    const toggleBtn = document.getElementById('toggle-edit-btn');
    const modal = document.getElementById('modal-overlay');
    const titleInput = document.getElementById('event-title-input');
    const deleteBtn = document.getElementById('btn-delete');
    const colorLabel = document.getElementById('event-color-label');
    const colorSection = document.querySelector('.color-picker');
    
    let isEditMode = false;
    let currentEditingEvent = null;
    let selectedColor = "#3498db";

    const ICAL_SOURCES = [
        { url: "https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=26389&projectId=4&calType=ical&nbWeeks=28&daysBefore=60", color: "#4A90E2" }, 
        { url: "https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=17816&projectId=4&calType=ical&nbWeeks=28&daysBefore=60", color: "#50C878" }, 
        { url: "https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=47289&projectId=4&calType=ical&nbWeeks=28&daysBefore=60", color: "#c85050" }
    ];

    // --- SYNCHRONISATION SUPABASE ---
    async function syncIcalToSupabase() {
        const proxy = "https://corsproxy.io/?";
        const seenUids = new Set();
        let eventsToUpsert = [];

        for (let source of ICAL_SOURCES) {
            try {
                const response = await fetch(proxy + encodeURIComponent(source.url));
                const icsData = await response.text();
                const jcalData = ICAL.parse(icsData);
                const comp = new ICAL.Component(jcalData);
                const vevents = comp.getAllSubcomponents('vevent');

                vevents.forEach(vevent => {
                    const event = new ICAL.Event(vevent);
                    if (seenUids.has(event.uid)) return;
                    seenUids.add(event.uid);

                    const descLines = (event.description || '').split('\n').map(l => l.trim()).filter(l => l !== "");
                    
                    eventsToUpsert.push({
                        id: event.uid,
                        titre: event.summary,
                        debut: event.startDate.toJSDate().toISOString(),
                        fin: event.endDate.toJSDate().toISOString(),
                        salle: event.location || 'N/A',
                        prof: descLines[1] || '',
                        couleur: source.color
                    });
                });
            } catch (err) { console.error("Erreur flux iCal :", err); }
        }
        //MAJ de la base
        await sb.from('cours').upsert(eventsToUpsert, { onConflict: 'id' });
    }

    // --- GESTION MODALE ---
    function openModal(info, isNew = false) {
        currentEditingEvent = info;
        const saveBtn = document.getElementById('btn-save');
        const modalTitle = document.getElementById('modal-title-head');

        const title = isNew ? "" : info.event.title;
        titleInput.value = title;

        if (!isEditMode && !isNew) {
            modalTitle.innerText = "Détails du cours";
            titleInput.disabled = true;
            saveBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
            colorLabel.style.display = 'none';
            colorSection.style.display = 'none';
            document.getElementById('btn-cancel').innerText = "Fermer";
        } else {
            modalTitle.innerText = isNew ? "Nouveau cours" : "Modifier le cours";
            titleInput.disabled = false;
            saveBtn.style.display = 'block';
            deleteBtn.style.display = isNew ? 'none' : 'block';
            colorLabel.style.display = 'block';
            colorSection.style.display = 'flex';
            document.getElementById('btn-cancel').innerText = "Annuler";
            selectedColor = isNew ? "#3498db" : info.event.backgroundColor;
        }
        modal.style.display = 'flex';
    }

    function closeModal() { modal.style.display = 'none'; currentEditingEvent = null; }

    document.getElementById('btn-cancel').addEventListener('click', closeModal);

    document.getElementById('btn-save').addEventListener('click', async () => {
        const id = currentEditingEvent.event ? currentEditingEvent.event.id : 'perso-' + Date.now();
        const eventData = {
            id: id,
            titre: titleInput.value || "Sans titre",
            debut: currentEditingEvent.event ? currentEditingEvent.event.startStr : currentEditingEvent.startStr,
            fin: currentEditingEvent.event ? currentEditingEvent.event.endStr : currentEditingEvent.endStr,
            couleur: selectedColor,
            manuellement_modifie: true,
            salle: currentEditingEvent.event ? currentEditingEvent.event.extendedProps.location : 'Perso'
        };
        //MAJ de la base
        await sb.from('cours').upsert(eventData);
        calendar.refetchEvents();
        closeModal();
    });

    deleteBtn.addEventListener('click', async () => {
        if (currentEditingEvent.event) {
            await sb.from('cours').delete().eq('id', currentEditingEvent.event.id);
            calendar.refetchEvents();
            closeModal();
        }
    });

    document.querySelectorAll('.color-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            selectedColor = opt.getAttribute('data-color');
            document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });

    // --- CALENDRIER ---
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'fr',
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        allDaySlot: false,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' },
        events: async function(info, successCallback) {
            await syncIcalToSupabase();
            // interrogation base de donnée
            const { data } = await sb.from('cours').select('*');
            successCallback(data.map(c => ({
                id: c.id, title: c.titre, start: c.debut, end: c.fin,
                backgroundColor: c.couleur, borderColor: c.couleur,
                extendedProps: { location: c.salle, prof: c.prof }
            })));
        },
        eventContent: function(arg) {
            let container = document.createElement('div');
            container.innerHTML = `<b>${arg.event.title}</b><br><small>📍 ${arg.event.extendedProps.location || ''}</small>`;
            return { domNodes: [container] };
        },
        select: function(info) { if (isEditMode) openModal(info, true); calendar.unselect(); },
        eventClick: function(info) { openModal(info, false); },
        eventDrop: async function(info) {
            if (!isEditMode) return;
            const eventData = {
                id: info.event.id,
                debut: info.event.start.toISOString(),
                fin: info.event.end.toISOString(),
                manuellement_modifie: true
            };
            //MAJ de la base
            await sb.from('cours').upsert(eventData);
        }
    });

    toggleBtn.addEventListener('click', function() {
        isEditMode = !isEditMode;
        calendar.setOption('editable', isEditMode);
        calendar.setOption('selectable', isEditMode);
        toggleBtn.innerHTML = isEditMode ? "Mode Édition 🔓" : "Mode Lecture 🔒";
        toggleBtn.className = isEditMode ? "btn-edit" : "btn-read";
        document.body.classList.toggle('editing-active', isEditMode);
    });

    calendar.render();
});