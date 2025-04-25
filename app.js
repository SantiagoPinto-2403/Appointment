document.getElementById('appointmentForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    // Get form values
    const appointmentId = document.getElementById('appointmentId').value;
    const status = document.getElementById('status').value;
    const appointmentType = document.getElementById('appointmentType').value;
    const startDateTime = document.getElementById('startDateTime').value;
    const endDateTime = document.getElementById('endDateTime').value;
    const patientReference = document.getElementById('patientReference').value;
    const patientDisplay = document.getElementById('patientDisplay').value;
    const practitionerReference = document.getElementById('practitionerReference').value;
    const practitionerDisplay = document.getElementById('practitionerDisplay').value;

    // Create Appointment object
    const appointment = {
        resourceType: "Appointment",
        id: appointmentId,
        status: status,
        appointmentType: {
            coding: [{
                system: "http://terminology.hl7.org/CodeSystem/v2-0276",
                code: appointmentType,
                display: appointmentType.charAt(0).toUpperCase() + appointmentType.slice(1).toLowerCase() + " appointment"
            }]
        },
        start: new Date(startDateTime).toISOString(),
        end: new Date(endDateTime).toISOString(),
        created: new Date().toISOString(),
        participant: [
            {
                actor: {
                    reference: patientReference,
                    display: patientDisplay
                },
                status: "accepted"
            },
            {
                actor: {
                    reference: practitionerReference,
                    display: practitionerDisplay
                },
                status: "accepted"
            }
        ]
    };

    // Send data
    fetch('https://back-end-santiago.onrender.com/appointment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(appointment)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        alert('Cita creada exitosamente!');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al crear la cita: ' + error.message);
    });
});
