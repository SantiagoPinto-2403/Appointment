document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('imagingStudyForm');
    const verifyBtn = document.getElementById('verifyAppointmentBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    // Store verified appointment data
    let verifiedAppointment = null;
    
    // Set default datetime to now with proper format
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - timezoneOffset).toISOString().slice(0, 16);
    document.getElementById('started').value = localISOTime;

    // Verify Appointment
    verifyBtn.addEventListener('click', async function() {
        const apptId = document.getElementById('appointmentId').value.trim();
        
        if (!apptId) {
            showAlert('Error', 'Please enter the appointment ID', 'error');
            return;
        }
        
        try {
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<span class="spinner"></span> Verifying...';
            
            const response = await fetch(`https://back-end-santiago.onrender.com/appointment/${apptId}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Appointment not found');
            }
            
            const data = await response.json();
            
            // Check if the response contains valid appointment data
            if (!data || !data.resourceType || data.resourceType !== 'Appointment') {
                throw new Error('Invalid server response');
            }
            
            // Store the verified appointment data
            verifiedAppointment = data;
            
            // Display appointment info
            const patientRef = verifiedAppointment.participant?.find(p => 
                p.actor?.reference?.startsWith('Patient/')
            )?.actor?.reference || 'Patient/unknown';
            
            const patientId = patientRef.split('/')[1] || 'Unknown';
            const modality = verifiedAppointment.appointmentType?.text || 'Not specified';
            
            const statusMap = {
                'booked': 'Scheduled',
                'arrived': 'Patient present',
                'fulfilled': 'Completed',
                'cancelled': 'Cancelled',
                'noshow': 'No show'
            };
            
            const status = statusMap[verifiedAppointment.status] || verifiedAppointment.status || 'Unknown';
            const date = verifiedAppointment.start ? new Date(verifiedAppointment.start).toLocaleString() : 'Not specified';
            
            document.getElementById('appointmentInfo').innerHTML = `
                <strong>Valid Appointment</strong><br>
                Patient ID: ${patientId}<br>
                Modality: ${modality}<br>
                Status: ${status}<br>
                Date: ${date}
            `;
            
        } catch (error) {
            verifiedAppointment = null;
            showAlert('Error', error.message, 'error');
            document.getElementById('appointmentInfo').textContent = '';
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify';
        }
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Processing...';
            
            // Verify appointment was checked and get the stored data
            if (!verifiedAppointment) {
                throw new Error('Please verify the appointment first');
            }
            
            // Get form values
            const modalityCode = document.getElementById('modality').value;
            const started = document.getElementById('started').value;
            const description = document.getElementById('description').value.trim();
            
            if (!modalityCode) {
                throw new Error('Please select a modality');
            }
            
            if (!started) {
                throw new Error('Please enter the study date and time');
            }
            
            // Get patient reference from verified appointment
            const patientRef = verifiedAppointment.participant?.find(p => 
                p.actor?.reference?.startsWith('Patient/')
            )?.actor?.reference || 'Patient/unknown';
            
            // Build properly formatted ImagingStudy object with verified data
            const imagingStudyData = {
                resourceType: "ImagingStudy",
                status: "available",
                basedOn: [{
                    reference: `Appointment/${verifiedAppointment.id || verifiedAppointment._id}`
                }],
                modality: [{
                    system: "http://dicom.nema.org/resources/ontology/DCM",
                    code: modalityCode
                }],
                started: `${started}:00Z`,  // Add seconds and Zulu timezone
                description: description || "Radiology imaging study",
                subject: {
                    reference: patientRef  // Use the patient from the appointment
                },
                numberOfSeries: 1,
                numberOfInstances: 1,
                series: [{
                    uid: "1.2.3." + Math.floor(Math.random() * 1000000),  // Generate dummy UID
                    number: 1,
                    modality: {
                        code: modalityCode
                    },
                    numberOfInstances: 1
                }]
            };

            console.log("Submitting ImagingStudy with verified appointment:", imagingStudyData);
            
            // Submit to backend
            const response = await fetch('https://back-end-santiago.onrender.com/imagingstudy', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(imagingStudyData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to create Imaging Study');
            }
            
            const data = await response.json();
            
            showAlert('Success', 'Imaging Study created successfully', 'success');
            form.reset();
            verifiedAppointment = null;
            document.getElementById('appointmentInfo').textContent = '';
            document.getElementById('started').value = localISOTime;
            
        } catch (error) {
            console.error("Error:", error);
            showAlert('Error', error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="button-text">Create Imaging Study</span>';
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