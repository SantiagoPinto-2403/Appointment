document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('appointmentForm');
    const submitBtn = document.getElementById('submitBtn');
    const buttonText = submitBtn.querySelector('.texto-boton');
    const spinner = document.getElementById('spinner');

    // Set default date to today
    const today = new Date();
    document.getElementById('appointmentDate').valueAsDate = today;

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Show loading state
        submitBtn.disabled = true;
        spinner.style.display = 'inline-block';
        buttonText.textContent = 'Procesando...';
        
        try {
            // Create Appointment object with patient identifier
            const appointment = {
                resourceType: "Appointment",
                status: document.getElementById('status').value,
                appointmentType: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/v2-0276",
                        code: document.getElementById('appointmentType').value,
                        display: document.getElementById('appointmentType').options[document.getElementById('appointmentType').selectedIndex].text
                    }]
                },
                start: new Date(document.getElementById('appointmentDate').value).toISOString(),
                created: new Date().toISOString(),
                basedOn: [{
                    reference: `ServiceRequest/${document.getElementById('serviceRequestId').value}`
                }],
                participant: [
                    {
                        actor: {
                            identifier: {
                                system: document.getElementById('patientIdentifierSystem').value,
                                value: document.getElementById('patientIdentifierValue').value
                            },
                            type: "Patient"
                        },
                        status: "accepted"
                    },
                    {
                        actor: {
                            reference: document.getElementById('practitionerReference').value,
                            type: "Practitioner"
                        },
                        status: "accepted"
                    }
                ]
            };

            // Add description if provided
            const description = document.getElementById('description').value.trim();
            if (description) {
                appointment.description = description;
            }

            // Send to backend
            const response = await fetch('https://back-end-santiago.onrender.com/appointment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(appointment)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al crear la cita');
            }

            // Show success
            await Swal.fire({
                title: '¡Éxito!',
                text: 'La cita ha sido agendada correctamente',
                icon: 'success',
                confirmButtonColor: '#7c34db'
            });

            // Reset form
            form.reset();
            document.getElementById('appointmentDate').valueAsDate = new Date();

        } catch (error) {
            console.error('Error:', error);
            await Swal.fire({
                title: 'Error',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#7c34db'
            });
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            spinner.style.display = 'none';
            buttonText.textContent = 'Agendar Cita';
        }
    });

    // Validate ServiceRequest ID when leaving the field
    document.getElementById('serviceRequestId').addEventListener('blur', async function() {
        const serviceRequestId = this.value.trim();
        if (!serviceRequestId) return;
        
        try {
            const response = await fetch(`https://back-end-santiago.onrender.com/servicerequest/${serviceRequestId}`);
            if (!response.ok) {
                await Swal.fire({
                    title: 'Advertencia',
                    text: 'La solicitud de servicio no existe',
                    icon: 'warning',
                    confirmButtonColor: '#7c34db'
                });
            }
        } catch (error) {
            console.error('Error validating ServiceRequest:', error);
        }
    });
});