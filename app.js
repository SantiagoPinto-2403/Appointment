document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('appointmentForm');
    const verifyBtn = document.getElementById('verifyRequestBtn');
    const submitBtn = document.getElementById('submitBtn');
    const serviceRequestIdInput = document.getElementById('serviceRequestId');
    const requestInfoDisplay = document.getElementById('requestInfo');
    
    let currentServiceRequest = null;
    
    // Initialize form
    function initForm() {
        // Set default date to today
        const today = new Date();
        document.getElementById('appointmentDate').valueAsDate = today;
        
        // Set minimum date to today
        document.getElementById('appointmentDate').min = today.toISOString().split('T')[0];
        
        // Clear any existing state
        currentServiceRequest = null;
        requestInfoDisplay.textContent = '';
        serviceRequestIdInput.focus();
    }
    
    // Verify ServiceRequest
    verifyBtn.addEventListener('click', async function() {
        const srId = serviceRequestIdInput.value.trim();
        
        if (!srId) {
            showAlert('Error', 'Por favor ingrese el ID de la solicitud', 'error');
            serviceRequestIdInput.focus();
            return;
        }
        
        try {
            // UI feedback
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<span class="spinner"></span> Verificando...';
            requestInfoDisplay.textContent = 'Verificando solicitud...';
            
            // Check if appointment already exists
            const existingAppt = await checkExistingAppointment(srId);
            if (existingAppt) {
                throw new Error(`Ya existe una cita para esta solicitud (ID: ${existingAppt})`);
            }
            
            // Verify ServiceRequest exists
            const response = await fetchWithTimeout(
                `https://back-end-santiago.onrender.com/servicerequest/${srId}`,
                {
                    timeout: 5000 // 5 seconds timeout
                }
            );
            
            let serviceRequest;
            if (response.ok) {
                serviceRequest = await response.json();
            } else {
                // Fallback: Try by identifier if not found by ID
                const altResponse = await fetchWithTimeout(
                    `https://back-end-santiago.onrender.com/servicerequest?system=http://hospital.sistema/solicitudes&value=${srId}`,
                    {
                        timeout: 5000
                    }
                );
                
                if (!altResponse.ok) {
                    throw new Error('Solicitud no encontrada. Verifique el ID e intente nuevamente.');
                }
                
                serviceRequest = await altResponse.json();
            }
            
            // Check if service request is in a valid state
            if (!['active', 'completed'].includes(serviceRequest.status)) {
                throw new Error('La solicitud no está en un estado válido para agendar');
            }
            
            // Store the verified request
            currentServiceRequest = serviceRequest;
            
            // Display request info
            requestInfoDisplay.innerHTML = `
                <div class="request-info-content">
                    <h3>Solicitud verificada</h3>
                    <p><strong>ID:</strong> ${serviceRequest.id || srId}</p>
                    <p><strong>Paciente:</strong> ${getPatientName(serviceRequest.subject)}</p>
                    <p><strong>Prioridad:</strong> ${mapPriority(serviceRequest.priority)}</p>
                    <p><strong>Estudio:</strong> ${getProcedureName(serviceRequest.code)}</p>
                    ${serviceRequest.note?.[0]?.text ? `<p><strong>Notas:</strong> ${serviceRequest.note[0].text}</p>` : ''}
                </div>
            `;
            
            // Enable form submission
            document.getElementById('appointmentDate').focus();
            
        } catch (error) {
            currentServiceRequest = null;
            requestInfoDisplay.textContent = '';
            showAlert('Error', error.message, 'error');
            serviceRequestIdInput.focus();
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verificar';
        }
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // UI feedback
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';
            
            // Validate
            if (!currentServiceRequest) {
                throw new Error('Por favor verifique la solicitud primero');
            }
            
            const appointmentDate = document.getElementById('appointmentDate').value;
            const modality = document.getElementById('modality').value;
            const notes = document.getElementById('notes').value.trim();
            
            if (!appointmentDate) throw new Error('Seleccione una fecha válida');
            if (!modality) throw new Error('Seleccione una modalidad');
            
            // Double-check for duplicates (race condition protection)
            const existingAppt = await checkExistingAppointment(currentServiceRequest.id);
            if (existingAppt) {
                throw new Error(`Ya existe una cita para esta solicitud (ID: ${existingAppt})`);
            }
            
            // Create appointment payload
            const appointmentData = {
                resourceType: "Appointment",
                status: "booked",
                basedOn: [{ 
                    reference: `ServiceRequest/${currentServiceRequest.id}`,
                    display: `Solicitud ${currentServiceRequest.id}`
                }],
                start: `${appointmentDate}T09:00:00Z`, // Default morning time
                end: `${appointmentDate}T09:30:00Z`,  // 30 min default duration
                appointmentType: { 
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/v2-0276",
                        code: modality
                    }],
                    text: getModalityText(modality)
                },
                description: notes || "Cita radiológica programada",
                participant: [{
                    actor: { 
                        reference: "Practitioner/radiologo",
                        display: "Radiólogo asignado"
                    },
                    status: "accepted"
                }],
                patientInstruction: "Llegar 15 minutos antes con orden médica"
            };
            
            // Create appointment
            const response = await fetchWithTimeout(
                'https://back-end-santiago.onrender.com/appointment', 
                {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(appointmentData),
                    timeout: 10000 // 10 seconds timeout
                }
            );
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Error al crear la cita');
            }
            
            const data = await response.json();
            
            // Success - show confirmation and reset form
            showAlert(
                'Cita creada', 
                `La cita se ha creado exitosamente (ID: ${data.id})`, 
                'success'
            );
            
            // Reset form for new entry
            initForm();
            
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
            const response = await fetchWithTimeout(
                `https://back-end-santiago.onrender.com/appointment/service-request/${serviceRequestId}`,
                {
                    timeout: 5000
                }
            );
            
            if (!response.ok) return null;
            
            const data = await response.json();
            return data.length > 0 ? data[0].id : null;
        } catch (error) {
            console.error("Error checking existing appointment:", error);
            return null;
        }
    }
    
    function fetchWithTimeout(url, options = {}) {
        const { timeout = 8000, ...fetchOptions } = options;
        
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error('Tiempo de espera agotado. Por favor intente nuevamente.'));
            }, timeout);
            
            fetch(url, { ...fetchOptions, signal: controller.signal })
                .then(response => {
                    clearTimeout(timeoutId);
                    resolve(response);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }
    
    function getPatientName(subjectReference) {
        if (!subjectReference) return 'Paciente no especificado';
        if (subjectReference.display) return subjectReference.display;
        return subjectReference.reference ? subjectReference.reference.split('/')[1] : 'Paciente';
    }
    
    function getProcedureName(code) {
        if (!code) return 'Procedimiento no especificado';
        if (code.text) return code.text;
        if (code.coding?.[0]?.display) return code.coding[0].display;
        return code.coding?.[0]?.code || 'Procedimiento';
    }
    
    function getModalityText(modalityCode) {
        const modalities = {
            'RX': 'Radiografía',
            'CT': 'Tomografía Computarizada',
            'MRI': 'Resonancia Magnética',
            'US': 'Ultrasonido'
        };
        return modalities[modalityCode] || modalityCode;
    }
    
    function mapPriority(priority) {
        const priorities = {
            'routine': 'Rutina',
            'urgent': 'Urgente',
            'asap': 'Lo antes posible',
            'stat': 'Inmediato'
        };
        return priorities[priority] || priority;
    }
    
    function showAlert(title, text, icon) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                html: text,
                icon: icon,
                confirmButtonText: 'OK',
                confirmButtonColor: '#3498db'
            });
        } else {
            alert(`${title}\n\n${text}`);
        }
    }
    
    // Initialize the form
    initForm();
});