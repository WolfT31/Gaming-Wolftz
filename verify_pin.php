<?php
// verify_pin.php - Secure server-side PIN verification
session_start();
header('Content-Type: application/json');

// Set your valid PINs here (change these to your actual PINs)
$VALID_PINS = ['1516']; // Add your PINs here

// Get PIN from POST request
$pin = $_POST['pin'] ?? '';

// Security: Rate limiting
$ip = $_SERVER['REMOTE_ADDR'];
$now = time();

// Initialize attempts array if not exists
if (!isset($_SESSION['attempts'])) {
    $_SESSION['attempts'] = [];
}

// Clean old attempts (last 5 minutes)
$_SESSION['attempts'] = array_filter($_SESSION['attempts'], function($attempt) use ($now) {
    return $attempt['time'] > ($now - 300);
});

// Check if blocked (more than 5 failed attempts in 5 minutes)
$recentFailed = array_filter($_SESSION['attempts'], function($attempt) use ($ip) {
    return $attempt['ip'] === $ip && !$attempt['success'];
});

if (count($recentFailed) >= 2) {
    echo json_encode([
        'success' => false,
        'message' => 'Too many failed attempts. Try again in 5 minutes.'
    ]);
    exit;
}

// Validate PIN
if (in_array($pin, $VALID_PINS)) {
    // SUCCESS
    $_SESSION['pin_verified'] = true;
    $_SESSION['verified_at'] = $now;
    
    // Log successful attempt
    $_SESSION['attempts'][] = [
        'ip' => $ip,
        'time' => $now,
        'success' => true
    ];
    
    echo json_encode([
        'success' => true,
        'message' => 'Access granted'
    ]);
} else {
    // FAILURE
    $_SESSION['attempts'][] = [
        'ip' => $ip,
        'time' => $now,
        'success' => false
    ];
    
    echo json_encode([
        'success' => false,
        'message' => 'Invalid PIN code'
    ]);
}
?>