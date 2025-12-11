// js/main.js
function detectDevice() {
  const ua = navigator.userAgent;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  // Rileva TV (Smart TV, WebOS, Tizen, Android TV, etc.)
  const isTV = ua.includes('SmartTV') || 
               ua.includes('WebOS') || 
               ua.includes('Tizen') || 
               ua.includes('Android TV') ||
               ua.includes('AppleTV') ||
               ua.includes('CrKey') ||
               ua.includes('HbbTV') ||
               (screenWidth >= 1600 && screenHeight >= 900 && !ua.includes('Mobile'));
  
  // Rileva tablet
  const isTablet = /iPad|Android(?!.*Mobile)|Tablet|Silk/i.test(ua) || 
                   (screenWidth >= 600 && screenWidth <= 1200 && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua));
  
  // Rileva iOS
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  
  // Rileva Android mobile
  const isAndroidMobile = /Android.*Mobile/i.test(ua) && !isTablet;
  
  // Rileva PC
  const isPC = !isTV && !isTablet && !isIOS && !isAndroidMobile;
  
  console.log('User Agent:', ua);
  console.log('Screen:', screenWidth, 'x', screenHeight);
  console.log('Detected:', { isTV, isTablet, isIOS, isAndroidMobile, isPC });
  
  // Redirect alla versione corretta
  if (isTV && !window.location.href.includes('indexTV')) {
    window.location.href = 'indexTV.html';
  } else if (isTablet && !window.location.href.includes('indexTablet')) {
    window.location.href = 'indexTablet.html';
  } else if (isIOS && !window.location.href.includes('indexIOS')) {
    window.location.href = 'indexIOS.html';
  } else if (isAndroidMobile && !window.location.href.includes('indexAndroidCell')) {
    window.location.href = 'indexAndroidCell.html';
  } else if (isPC && !window.location.href.includes('indexPC')) {
    window.location.href = 'indexPC.html';
  }
}

// Esegui al caricamento
document.addEventListener('DOMContentLoaded', detectDevice);

// Se c'è un errore nel redirect, ricarica la pagina fallback
window.addEventListener('error', function() {
  if (!window.location.href.includes('index.html')) {
    console.log('Error detected, redirecting to fallback...');
    window.location.href = 'index.html';
  }
});