document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('appointmentForm');
            const verifyBtn = document.getElementById('verifyRequestBtn');
            const submitBtn = document.getElementById('submitBtn');
            const serviceRequestIdInput = document.getElementById('serviceRequestId');
            const requestInfoDisplay = document.getElementById('requestInfo');
            
            let currentServiceRequest = null;
            
            // Initialize form
            function initForm() {
                const today = new Date();
                document.getElementById('appointmentDate').valueAsDate = today;
                document.getElementById('appointmentDate').min = today.toISOString().split('T')[0];
                currentServiceRequest = null;
                requestInfoDisplay.textContent = '';
                serviceRequestIdInput.focus();
            }
            
            // Verify ServiceRequest
            verifyBtn.addEventListener('click', verifyServiceRequest);
            
            // Form submission
            form.addEventListener('submit', submitAppointmentForm);
            
            async function verifyServiceRequest() {
                const srId = serviceRequestIdInput.value.trim();
                
                if (!srId) {
                    showAlert('Error', 'Por favor ingrese el ID de la solicitud', 'error');
                    serviceRequestIdInput.focus();
                    return;
                }
                
                try {
                    verifyBtn.disabled = true;
                    verifyBtn.innerHTML = '<span class="spinner"></span> Verificando...';
                    requestInfoDisplay.textContent = 'Verificando solicitud...';
                    
                    const existingAppt = await checkExistingAppointment(srId);
                    if (existingAppt) {
                        throw new Error(`Ya existe una cita para esta solicitud (ID: ${existingAppt})`);
                    }
                    
                    const serviceRequest = await fetchServiceRequest(srId);
                    
                    if (!['active', 'completed'].includes(serviceRequest.status)) {
                        throw new Error('La solicitud no está en un estado válido para agendar');
                    }
                    
                    currentServiceRequest = serviceRequest;
                    displayServiceRequestInfo(serviceRequest, srId);
                    document.getElementById('appointmentDate').focus();
                    
                } catch (error) {
                    handleVerificationError(error);
                } finally {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verificar';
                }
            }

            async function fetchServiceRequest(srId) {
                try {
                    const response = await fetchWithTimeout(
                        `https://back-end-santiago.onrender.com/servicerequest/${srId}`,
                        { timeout: 5000 }
                    );
                    
                    if (response.ok) return await response.json();
                    
                    // Fallback to identifier search
                    const altResponse = await fetchWithTimeout(
                        `https://back-end-santiago.onrender.com/servicerequest?system=http://hospital.sistema/solicitudes&value=${srId}`,
                        { timeout: 5000 }
                    );
                    
                    if (!altResponse.ok) {
                        throw new Error('Solicitud no encontrada. Verifique el ID e intente nuevamente.');
                    }
                    
                    return await altResponse.json();
                } catch (error) {
                    throw new Error(`Error al verificar la solicitud: ${error.message}`);
                }
            }

            function displayServiceRequestInfo(serviceRequest, srId) {
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
                serviceRequestIdInput.classList.remove('error');
                serviceRequestIdInput.classList.add('success');
            }

            function handleVerificationError(error) {
                currentServiceRequest = null;
                requestInfoDisplay.textContent = '';
                serviceRequestIdInput.classList.add('error');
                serviceRequestIdInput.classList.remove('success');
                showAlert('Error', error.message, 'error');
                serviceRequestIdInput.focus();
            }

            async function submitAppointmentForm(e) {
                e.preventDefault();
                
                try {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';
                    
                    if (!currentServiceRequest) {
                        throw new Error('Por favor verifique la solicitud primero');
                    }
                    
                    const validationErrors = validateForm();
                    if (validationErrors.length > 0) {
                        throw new Error(validationErrors.join('\n'));
                    }
                    
                    const existingAppt = await checkExistingAppointment(currentServiceRequest.id);
                    if (existingAppt) {
                        throw new Error(`Ya existe una cita para esta solicitud (ID: ${existingAppt})`);
                    }
                    
                    const response = await createAppointment();
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || 'Error al crear la cita');
                    }
                    
                    const data = await response.json();
                    showSuccessAlert(data);
                    initForm();
                    
                } catch (error) {
                    showAlert('Error', error.message, 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span class="button-text">Agendar Cita</span>';
                }
            }

            function validateForm() {
                const errors = [];
                if (!document.getElementById('appointmentDate').value) {
                    document.getElementById('appointmentDate').classList.add('error');
                    errors.push('Seleccione una fecha válida');
                }
                if (!document.getElementById('modality').value) {
                    document.getElementById('modality').classList.add('error');
                    errors.push('Seleccione una modalidad');
                }
                return errors;
            }

            async function createAppointment() {
                const appointmentDate = document.getElementById('appointmentDate').value;
                const modality = document.getElementById('modality').value;
                const notes = document.getElementById('notes').value.trim();
                
                const appointmentData = {
                    resourceType: "Appointment",
                    status: "booked",
                    basedOn: [{ 
                        reference: `ServiceRequest/${currentServiceRequest.id}`,
                        display: `Solicitud ${currentServiceRequest.id}`
                    }],
                    start: `${appointmentDate}T09:00:00Z`,
                    end: `${appointmentDate}T09:30:00Z`,
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
                
                return await fetchWithTimeout(
                    'https://back-end-santiago.onrender.com/appointment', 
                    {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(appointmentData),
                        timeout: 10000
                    }
                );
            }

            function showSuccessAlert(data) {
                showAlert(
                    'Cita creada exitosamente', 
                    `Se ha agendado la cita correctamente.<br><br>
                    <strong>ID de Cita:</strong> ${data.id}<br>
                    <strong>Paciente:</strong> ${getPatientName(currentServiceRequest.subject)}<br>
                    <strong>Estudio:</strong> ${getProcedureName(currentServiceRequest.code)}<br>
                    <strong>Fecha:</strong> ${formatDate(document.getElementById('appointmentDate').value)}`, 
                    'success'
                );
            }

            // Helper functions
            async function checkExistingAppointment(serviceRequestId) {
                if (!serviceRequestId || serviceRequestId === "undefined") {
                    console.error("Invalid service request ID:", serviceRequestId);
                    return null;
                }
    
                try {
                    const response = await fetchWithTimeout(
                        `https://back-end-santiago.onrender.com/appointment/service-request/${serviceRequestId}`,
                        {
                            timeout: 5000,
                            headers: {
                                'Accept': 'application/json'
                            }
                        }
                    );
        
                    if (!response.ok) {
            // Handle 404 specifically (no appointment exists)
                        if (response.status === 404) {
                            return null;
                        }
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
        
                    const data = await response.json();
        
        // Handle both array and single object responses
                    if (Array.isArray(data)) {
                        return data.length > 0 ? data[0].id : null;
                    }
                    return data?.id || null;
        
                } catch (error) {
                    console.error("Error checking existing appointment:", error);
                    showAlert('Error', 'No se pudo verificar citas existentes. Intente nuevamente.', 'error');
                    return null;
                }
            }
            
            function fetchWithTimeout(url, options = {}) {
                const { timeout = 8000, ...fetchOptions } = options;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                return fetch(url, { ...fetchOptions, signal: controller.signal })
                    .finally(() => clearTimeout(timeoutId));
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
                    'RX': 'Radiografía', 'CT': 'Tomografía', 
                    'MRI': 'Resonancia', 'US': 'Ultrasonido'
                };
                return modalities[modalityCode] || modalityCode;
            }
            
            function mapPriority(priority) {
                const priorities = {
                    'routine': 'Rutina', 'urgent': 'Urgente',
                    'asap': 'ASAP', 'stat': 'STAT'
                };
                return priorities[priority] || priority;
            }
            
            function formatDate(dateString) {
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                return new Date(dateString).toLocaleDateString('es-ES', options);
            }
            
            function showAlert(title, html, icon) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: title,
                        html: html,
                        icon: icon,
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#3498db'
                    });
                } else {
                    alert(`${title}\n\n${html.replace(/<[^>]*>/g, '')}`);
                }
            }
            
            // Initialize the form
            initForm();
        });