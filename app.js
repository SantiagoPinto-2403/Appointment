document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('appointmentForm');
    const verifyBtn = document.getElementById('verifyRequestBtn');
    const submitBtn = document.getElementById('submitBtn');
    let currentServiceRequest = null; // Store verified request
    
    // Set default date to today
    document.getElementById('appointmentDate').valueAsDate = new Date();

    // ServiceRequest Verification
    verifyBtn.addEventListener('click', async function() {
        const srId = document.getElementById('serviceRequestId').value.trim();
        
        if (!srId) {
            showAlert('Error', 'Por favor ingrese el ID de la solicitud', 'error');
            return;
        }
        
        try {
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<span class="spinner"></span> Verificando...';
            
            // First try direct ID lookup
            let response = await fetch(`https://back-end-santiago.onrender.com/servicerequest/${srId}`);
            let data = await response.json();
            
            // If not found, try by identifier
            if (!response.ok) {
                response = await fetch(`https://back-end-santiago.onrender.com/servicerequest?system=http://hospital.sistema/solicitudes&value=${srId}`);
                data = await response.json();
                
                if (!response.ok) {
                    throw new Error('Solicitud no encontrada');
                }
            }
            
            currentServiceRequest = data;
            
            // Display request info
            const patientId = currentServiceRequest.subject?.identifier?.value || 'N/A';
            const priorityMap = {
                'routine': 'Rutina',
                'urgent': 'Urgente',
                'asap': 'ASAP',
                'stat': 'STAT'
            };
            const priority = priorityMap[currentServiceRequest.priority] || currentServiceRequest.priority;
            
            document.getElementById('requestInfo').innerHTML = `
                <strong>Solicitud Verificada</strong><br>
                ID: ${currentServiceRequest.id || srId}<br>
                Paciente: ${patientId}<br>
                Prioridad: ${priority}
            `;
            
        } catch (error) {
            currentServiceRequest = null;
            document.getElementById('requestInfo').textContent = '';
            showAlert('Error', error.message || 'Error al verificar la solicitud', 'error');
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verificar';
        }
    });

    // Form Submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';
            
            // Verify ServiceRequest was checked
            if (!currentServiceRequest) {
                throw new Error('Debe verificar una solicitud de servicio primero');
            }
            
            // Get form values
            const appointmentDate = document.getElementById('appointmentDate').value;
            const modality = document.getElementById('modality').value;
            const notes = document.getElementById('notes').value.trim();
            
            if (!appointmentDate) {
                throw new Error('Seleccione una fecha para la cita');
            }
            
            if (!modality) {
                throw new Error('Seleccione una modalidad');
            }
            
            // Build appointment
            const appointmentData = {
                resourceType: "Appointment",
                status: "booked",
                basedOn: [{
                    reference: `ServiceRequest/${currentServiceRequest.id}`
                }],
                start: appointmentDate,
                end: appointmentDate,
                appointmentType: {
                    coding: [{
                        system: "http://hl7.org/fhir/v2/0276",
                        code: modality
                    }],
                    text: getModalityText(modality)
                },
                description: notes || "Cita radiológica programada",
                participant: [{
                    actor: {
                        reference: "Practitioner/radiologo-default"
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
                throw new Error(data.detail || 'Error al crear la cita');
            }
            
            showAlert('Éxito', `Cita creada con ID: ${data.id}`, 'success');
            form.reset();
            currentServiceRequest = null;
            document.getElementById('requestInfo').textContent = '';
            document.getElementById('appointmentDate').valueAsDate = new Date();
            
        } catch (error) {
            showAlert('Error', error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="button-text">Agendar Cita</span>';
        }
    });
    
    function getModalityText(code) {
        const modalities = {
            'RX': 'Radiografía',
            'CT': 'Tomografía Computarizada',
            'MRI': 'Resonancia Magnética',
            'US': 'Ultrasonido',
            'MG': 'Mamografía'
        };
        return modalities[code] || code;
    }
    
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