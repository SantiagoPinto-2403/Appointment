document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('appointmentForm');
    const verifyBtn = document.getElementById('verifyRequestBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    // Set default date to today
    document.getElementById('appointmentDate').valueAsDate = new Date();

    // Verify ServiceRequest
    verifyBtn.addEventListener('click', async function() {
        const srId = document.getElementById('serviceRequestId').value.trim();
        
        if (!srId) {
            showAlert('Error', 'Ingrese un ID de solicitud', 'error');
            return;
        }
        
        try {
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<span class="spinner"></span> Verificando...';
            
            const response = await fetch(`https://back-end-santiago.onrender.com/servicerequest/${srId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Solicitud no encontrada');
            }
            
            document.getElementById('requestInfo').innerHTML = `
                <strong>Solicitud válida</strong><br>
                Prioridad: ${data.priority || 'No especificada'}
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
                throw new Error('Debe verificar la solicitud primero');
            }
            
            const appointmentData = {
                resourceType: "Appointment",
                status: "booked",  // Required by FHIR
                basedOn: [{
                    reference: `ServiceRequest/${document.getElementById('serviceRequestId').value.trim()}`
                }],
                start: document.getElementById('appointmentDate').value,
                end: document.getElementById('appointmentDate').value,  // Same day
                appointmentType: {
                    text: document.getElementById('modality').value
                },
                description: document.getElementById('notes').value.trim() || "Cita radiológica"
            };
            
            const response = await fetch('https://back-end-santiago.onrender.com/appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appointmentData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Error al agendar');
            }
            
            showAlert('Éxito', 'Cita agendada correctamente', 'success');
            form.reset();
            document.getElementById('requestInfo').textContent = '';
            document.getElementById('appointmentDate').valueAsDate = new Date();
            
        } catch (error) {
            showAlert('Error', error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="button-text">Agendar Cita</span>';
        }
    });
    
    function showAlert(title, text, icon) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ 
                title, 
                text, 
                icon,
                confirmButtonText: 'OK',
                confirmButtonColor: '#3498db'
            });
        } else {
            alert(`${title}\n\n${text}`);
        }
    }
});