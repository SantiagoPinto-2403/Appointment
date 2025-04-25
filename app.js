document.getElementById('patientForm').addEventListener('submit', function(event) {
    event.preventDefault();

    // Obtener los valores del formulario (simulando campos para Appointment)
    const name = document.getElementById('name').value;         // Nombre del paciente
    const familyName = document.getElementById('familyName').value; // Apellido del paciente
    const gender = document.getElementById('gender').value;     // Género (puede usarse en metadata)
    const birthDate = document.getElementById('birthDate').value; // Fecha nacimiento (metadata)
    const identifierSystem = document.getElementById('identifierSystem').value; // Sistema de identificación
    const identifierValue = document.getElementById('identifierValue').value;  // ID del paciente
    const cellPhone = document.getElementById('cellPhone').value; // Teléfono (para notificaciones)
    const email = document.getElementById('email').value;       // Email (para notificaciones)
    const address = document.getElementById('address').value;   // Dirección (opcional)
    const city = document.getElementById('city').value;         // Ciudad (opcional)

    // Crear el objeto **Appointment** (ajustado a tu JSON original)
    const appointment = {
        resourceType: "Appointment",
        id: "app-" + identifierValue, // Usamos el ID del paciente + prefijo
        status: "booked",
        appointmentType: {
            coding: [{
                system: "http://terminology.hl7.org/CodeSystem/v2-0276",
                code: "ROUTINE",  // Valor fijo como en tu ejemplo
                display: "Routine appointment"
            }]
        },
        start: new Date().toISOString(),  // Fecha actual como ejemplo
        end: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos después
        created: new Date().toISOString(),
        participant: [
            {
                actor: {
                    reference: "Patient/" + identifierValue, // Referencia al paciente
                    display: name + " " + familyName        // Nombre completo
                },
                status: "accepted"
            },
            {
                actor: {
                    reference: "Practitioner/1",  // Referencia fija (ejemplo)
                    display: "Dr. Smith"        // Nombre del médico (ejemplo)
                },
                status: "accepted"
            }
        ],
        // Metadata adicional (opcional)
        meta: {
            lastUpdated: new Date().toISOString()
        }
    };

    // Enviar los datos (mismo formato que el original)
    fetch('https://back-end-santiago.onrender.com/appointment', {  // Cambiado a endpoint de citas
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(appointment)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        alert('¡Cita médica creada exitosamente!');
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('Error al agendar la cita: ' + error.message);
    });
});
