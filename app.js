document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('appointmentForm');
            const verifyBtn = document.getElementById('verifyRequestBtn');
            const submitBtn = document.getElementById('submitBtn');
            let currentServiceRequest = null;
            
            // Set default date to today
            document.getElementById('appointmentDate').valueAsDate = new Date();

            // Verify ServiceRequest
            verifyBtn.addEventListener('click', async function() {
                const srId = document.getElementById('serviceRequestId').value.trim();
                
                if (!srId) {
                    showAlert('Error', 'Ingrese el ID de la solicitud', 'error');
                    return;
                }
                
                try {
                    verifyBtn.disabled = true;
                    verifyBtn.innerHTML = '<span class="spinner"></span> Verificando...';
                    
                    // Check if appointment already exists
                    const existingAppt = await checkExistingAppointment(srId);
                    if (existingAppt) {
                        throw new Error(`Ya existe una cita para esta solicitud (ID: ${existingAppt})`);
                    }
                    
                    // Verify ServiceRequest exists
                    const response = await fetch(`https://back-end-santiago.onrender.com/servicerequest/${srId}`);
                    if (!response.ok) {
                        // Fallback: Try by identifier
                        const altResponse = await fetch(
                            `https://back-end-santiago.onrender.com/servicerequest?system=http://hospital.sistema/solicitudes&value=${srId}`
                        );
                        if (!altResponse.ok) {
                            throw new Error('Solicitud no encontrada');
                        }
                        currentServiceRequest = await altResponse.json();
                    } else {
                        currentServiceRequest = await response.json();
                    }
                    
                    // Display request info
                    document.getElementById('requestInfo').innerHTML = `
                        <strong>Solicitud verificada</strong><br>
                        ID: ${currentServiceRequest.id || srId}<br>
                        Prioridad: ${mapPriority(currentServiceRequest.priority)}<br>
                        ${currentServiceRequest.note?.[0]?.text || ''}
                    `;
                    
                } catch (error) {
                    currentServiceRequest = null;
                    document.getElementById('requestInfo').textContent = '';
                    showAlert('Error', error.message, 'error');
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
                    
                    // Validate
                    if (!currentServiceRequest) {
                        throw new Error('Verifique la solicitud primero');
                    }
                    
                    const appointmentDate = document.getElementById('appointmentDate').value;
                    const modality = document.getElementById('modality').value;
                    const notes = document.getElementById('notes').value.trim();
                    
                    if (!appointmentDate) throw new Error('Seleccione una fecha');
                    if (!modality) throw new Error('Seleccione una modalidad');
                    
                    // Check again for duplicates (race condition protection)
                    const existingAppt = await checkExistingAppointment(currentServiceRequest.id);
                    if (existingAppt) {
                        throw new Error(`Ya existe una cita para esta solicitud (ID: ${existingAppt})`);
                    }
                    
                    // Create appointment
                    const response = await fetch('https://back-end-santiago.onrender.com/appointment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            resourceType: "Appointment",
                            status: "booked",
                            basedOn: [{ reference: `ServiceRequest/${currentServiceRequest.id}` }],
                            start: appointmentDate,
                            end: appointmentDate,
                            appointmentType: { text: modality },
                            description: notes || "Cita radiológica",
                            participant: [{
                                actor: { reference: "Practitioner/radiologo" },
                                status: "accepted"
                            }]
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.detail || 'Error al agendar');
                    }
                    
                    showAlert('Éxito', `Cita creada (ID: ${data.id})`, 'success');
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
            
            // Helper functions
            async function checkExistingAppointment(serviceRequestId) {
                try {
                    const response = await fetch(
                        `https://back-end-santiago.onrender.com/appointment/service-request/${serviceRequestId}`
                    );
                    const data = await response.json();
                    return data.length > 0 ? data[0].id : null;
                } catch (error) {
                    console.error("Check error:", error);
                    return null;
                }
            }
            
            function mapPriority(priority) {
                const priorities = {
                    'routine': 'Rutina',
                    'urgent': 'Urgente',
                    'asap': 'ASAP',
                    'stat': 'STAT'
                };
                return priorities[priority] || priority;
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