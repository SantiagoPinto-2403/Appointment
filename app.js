document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('appointmentForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const buttonText = submitBtn.querySelector('.texto-boton');
    
    // Set default date to today
    const today = new Date();
    document.getElementById('appointmentDate').valueAsDate = today;
    
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Show loading state
        submitBtn.disabled = true;
        const spinner = document.createElement('span');
        spinner.className = 'spinner';
        submitBtn.appendChild(spinner);
        buttonText.textContent = 'Procesando...';
        
        try {
            // Create Appointment object
            const appointment = {
                resourceType: "Appointment",
                status: document.getElementById('status').value,
                appointmentType: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/v2-0276",
                        code: document.getElementById('appointmentType').value,
                        display: document.getElementById('appointmentType').value.charAt(0).toUpperCase() + 
                                document.getElementById('appointmentType').value.slice(1).toLowerCase() + 
                                " appointment"
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
                            reference: document.getElementById('patientReference').value,
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
                throw new Error(errorData.message || 'Error al crear la cita');
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
            const spinner = submitBtn.querySelector('.spinner');
            if (spinner) spinner.remove();
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