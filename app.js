document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const form = document.getElementById('appointmentForm');
    const verifyBtn = document.getElementById('verifyRequestBtn');
    const submitBtn = document.getElementById('submitBtn');
    const serviceRequestIdInput = document.getElementById('serviceRequestId');
    const requestInfoDisplay = document.getElementById('requestInfo');
    
    // State
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
    
    // Event Listeners
    verifyBtn.addEventListener('click', verifyServiceRequest);
    form.addEventListener('submit', submitAppointmentForm);
    
    // Main Functions
    async function verifyServiceRequest() {
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
            
            // Check if service request exists
            const serviceRequest = await fetchServiceRequest(srId);
            
            // Check if appointment already exists
            const existingAppt = await checkExistingAppointment(serviceRequest.id || srId);
            if (existingAppt) {
                throw new Error(`Ya existe una cita para esta solicitud (ID: ${existingAppt})`);
            }
            
            // Check if service request is active
            if (!['active', 'completed'].includes(serviceRequest.status)) {
                throw new Error('La solicitud no está en un estado válido para agendar');
            }
            
            // Store and display the verified request
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

    async function submitAppointmentForm(event) {
        event.preventDefault();
    
        const submitBtn = document.getElementById('submitBtn');
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';

            // Validate form first
            const errors = validateForm();
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }

            // Get and properly format dates
            const dateValue = document.getElementById('appointmentDate').value;
            if (!dateValue) {
                throw new Error('Por favor seleccione una fecha válida');
            }

            // Create Date objects with proper time handling
            const startTime = new Date(`${dateValue}T09:00:00`);
            const endTime = new Date(`${dateValue}T09:30:00`);
            
            // Convert to ISO strings (UTC)
            const startISO = startTime.toISOString();
            const endISO = endTime.toISOString();

            // Gather form data
            const formData = {
                resourceType: "Appointment",
                status: "booked",
                basedOn: [{ 
                    reference: `ServiceRequest/${currentServiceRequest.id}`,
                    display: `Solicitud ${currentServiceRequest.id}`
                }],
                start: startISO,
                end: endISO,
                appointmentType: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/v2-0276",
                        code: document.getElementById('modality').value
                    }],
                    text: getModalityText(document.getElementById('modality').value)
                },
                description: document.getElementById('notes').value.trim() || "Cita radiológica programada",
                participant: [{
                    actor: { 
                        reference: "Practitioner/radiologo",
                        display: "Radiólogo asignado"
                    },
                    status: "accepted"
                }],
                patientInstruction: "Llegar 15 minutos antes con orden médica"
            };

            // Submit to server
            const result = await submitAppointmentToServer(formData);
        
            // Show success message
            showAppointmentSuccess(result.id);

        } catch (error) {
            showAppointmentError(error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Agendar Cita';
        }
    }
    
    // Helper Functions
    async function fetchServiceRequest(srId) {
        try {
            // Try direct ID lookup first
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

    async function checkExistingAppointment(serviceRequestId) {
        if (!serviceRequestId || serviceRequestId === "undefined") return null;
        
        try {
            const response = await fetchWithTimeout(
                `https://back-end-santiago.onrender.com/appointment/service-request/${serviceRequestId}`,
                { timeout: 5000 }
            );
            
            if (!response.ok) return null;
            
            const data = await response.json();
            return data.length > 0 ? data[0].id : null;
        } catch (error) {
            console.error("Error checking existing appointment:", error);
            return null;
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

    function validateForm() {
        const errors = [];
        
        if (!document.getElementById('appointmentDate').value) {
            document.getElementById('appointmentDate').classList.add('error');
            errors.push('Seleccione una fecha válida');
        } else {
            document.getElementById('appointmentDate').classList.remove('error');
        }
        
        if (!document.getElementById('modality').value) {
            document.getElementById('modality').classList.add('error');
            errors.push('Seleccione una modalidad');
        } else {
            document.getElementById('modality').classList.remove('error');
        }
        
        return errors;
    }

    async function submitAppointmentToServer(appointmentData) {
        try {
            // Validate required fields
            if (!appointmentData.basedOn || !appointmentData.basedOn[0]?.reference) {
                throw new Error('Missing ServiceRequest reference');
            }

            // Ensure dates are valid
            if (!isValidDate(appointmentData.start) || !isValidDate(appointmentData.end)) {
                throw new Error('Invalid date format');
            }

            const response = await fetchWithTimeout(
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || 'Failed to create appointment';
                throw new Error(errorMessage);
            }

            return await response.json();

        } catch (error) {
            console.error('Appointment submission failed:', error);
            throw error;
        }
    }

    function isValidDate(dateString) {
        if (!dateString) return false;
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    }
    
    function showSuccessMessage(responseData) {
        showAlert(
            'Cita creada exitosamente', 
            `Se ha agendado la cita correctamente.<br><br>
            <strong>ID de Cita:</strong> ${responseData.id}<br>
            <strong>Paciente:</strong> ${getPatientName(currentServiceRequest.subject)}<br>
            <strong>Estudio:</strong> ${getProcedureName(currentServiceRequest.code)}<br>
            <strong>Fecha:</strong> ${formatDate(document.getElementById('appointmentDate').value)}`, 
            'success'
        );
    }

    // Utility Functions
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

    function showAppointmentSuccess(appointmentId) {
        Swal.fire({
            title: 'Cita creada',
            html: `La cita se ha creado exitosamente<br><br>
                 <strong>ID de cita:</strong> ${appointmentId}<br>
                 <strong>Fecha:</strong> ${formatDate(document.getElementById('appointmentDate').value)}`,
            icon: 'success'
        });
        initForm(); // Reset the form after successful submission
    }

    function showAppointmentError(error) {
        let message = 'Error al crear la cita';
    
        if (error.message.includes('ServiceRequest')) {
            message = 'Error en la solicitud de servicio';
        } else if (error.message.includes('date') || error.message.includes('fecha')) {
            message = 'Error en las fechas de la cita';
        } else if (error.message.includes('already exists') || error.message.includes('ya existe')) {
            message = 'Ya existe una cita para esta solicitud';
        }
    
        Swal.fire({
            title: 'Error',
            html: `<strong>${message}</strong><br><br>${error.message}`,
            icon: 'error'
        });
    }

    // Initialize the form
    initForm();
});