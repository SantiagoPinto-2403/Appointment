document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('appointmentForm');
    const verifyBtn = document.getElementById('verifyRequestBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    // Set default date to today
    const today = new Date();
    document.getElementById('appointmentDate').valueAsDate = today;

    // Verify Service Request
    verifyBtn.addEventListener('click', async function() {
        const srId = document.getElementById('serviceRequestId').value.trim();
        
        if (!srId) {
            showAlert('Error', 'Por favor ingrese el ID de la solicitud de servicio', 'error');
            return;
        }
        
        try {
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<span class="spinner"></span> Verificando...';
            
            const response = await fetch(`https://back-end-santiago.onrender.com/servicerequest/${srId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'No se encontró la solicitud de servicio');
            }
            
            // Display request info
            const patientName = data.subject?.identifier?.value 
                ? `Paciente: ${data.subject.identifier.value}`
                : 'Paciente no especificado';
                
            const priorityMap = {
                'routine': 'Rutina',
                'urgent': 'Urgente',
                'asap': 'Lo antes posible',
                'stat': 'Inmediato'
            };
            
            const priority = priorityMap[data.priority] || data.priority || 'No especificada';
            
            document.getElementById('requestInfo').innerHTML = `
                <strong>Solicitud válida</strong><br>
                ${patientName}<br>
                Prioridad: ${priority}
            `;
            
        } catch (error) {
            showAlert('Error', error.message, 'error');
            document.getElementById('requestInfo').textContent = '';
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verificar';
        }
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';
            
            // Verify request was checked
            if (!document.getElementById('requestInfo').textContent) {
                throw new Error('Por favor verifique la solicitud de servicio primero');
            }
            
            // Get form values
            const srId = document.getElementById('serviceRequestId').value.trim();
            const appointmentDate = document.getElementById('appointmentDate').value;
            const modality = document.getElementById('modality').value;
            const notes = document.getElementById('notes').value.trim();
            
            if (!appointmentDate) {
                throw new Error('Por favor seleccione una fecha para la cita');
            }
            
            if (!modality) {
                throw new Error('Por favor seleccione una modalidad');
            }
            
            // Build appointment object
            const appointmentData = {
                resourceType: "Appointment",
                status: "booked",
                basedOn: [{
                    reference: `ServiceRequest/${srId}`
                }],
                start: appointmentDate,
                end: appointmentDate, // Same day
                appointmentType: {
                    text: modality
                },
                description: notes || "Cita radiológica programada",
                participant: [{
                    actor: {
                        reference: "Practitioner/radiologo" // Default radiologist
                    },
                    status: "accepted"
                }]
            };
            
            // Submit to backend
            const response = await fetch('https://back-end-santiago.onrender.com/appointment', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(appointmentData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Error al agendar la cita');
            }
            
            showAlert('Éxito', 'Cita agendada correctamente', 'success');
            form.reset();
            document.getElementById('requestInfo').textContent = '';
            document.getElementById('appointmentDate').valueAsDate = today;
            
        } catch (error) {
            showAlert('Error', error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="button-text">Agendar Cita</span>';
        }
    });
    
    // Alert helper function
    function showAlert(title, text, icon) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                text: text,
                icon: icon,
                confirmButtonText: 'OK',
                confirmButtonColor: '#3498db'
            });
        } else {
            alert(`${title}\n\n${text}`);
        }
    }
});