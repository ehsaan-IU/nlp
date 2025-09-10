const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to prompt for input
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// Function to create a new business
async function setupNewBusiness() {
    console.log('\n🚀 New Business Setup Wizard\n');
    
    // Get business ID (used for folder name)
    const businessId = await prompt('Enter business ID (lowercase, no spaces, e.g. pristine-carpet): ');
    if (!businessId || businessId.trim() === '') {
        console.error('❌ Business ID is required');
        rl.close();
        return;
    }
    
    // Create business directory
    const businessDir = path.join(__dirname, 'businesses', businessId);
    if (fs.existsSync(businessDir)) {
        console.error(`❌ Business directory already exists: ${businessId}`);
        rl.close();
        return;
    }
    
    // Create directory
    fs.mkdirSync(businessDir, { recursive: true });
    console.log(`✅ Created directory: businesses/${businessId}`);
    
    // Get business information
    const businessName = await prompt('Business Name: ');
    const businessType = await prompt('Business Type (e.g. Restaurant, Cleaning Service): ');
    const specialization = await prompt('Specialization: ');
    const location = await prompt('Location: ');
    const founded = await prompt('Founded Year: ');
    
    // Get contact information
    const phone = await prompt('Contact Phone: ');
    const email = await prompt('Contact Email: ');
    const website = await prompt('Website: ');
    const address = await prompt('Address: ');
    const hours = await prompt('Business Hours: ');
    
    // Get chatbot settings
    const greeting = await prompt('Chatbot Greeting Message: ');
    const fallback = await prompt('Chatbot Fallback Message: ');
    
    // Get primary color for theme
    const primaryColor = await prompt('Primary Color (hex code, e.g. #000000): ');
    
    // Create config.json
    const config = {
        business: {
            name: businessName,
            type: businessType,
            industry: businessType,
            location: location,
            founded: founded,
            specialization: specialization
        },
        chatbot: {
            personality: `Professional, friendly, and knowledgeable about ${businessType.toLowerCase()}`,
            tone: 'Helpful, informative, and customer-focused',
            expertise: specialization,
            greeting: greeting || `Hi! Welcome to ${businessName}. How can we help you today?`,
            fallback: fallback || `We're here to help with your ${businessType.toLowerCase()} needs. What would you like to know about our services?`,
            system_message: `You are a customer service chatbot for ${businessName}. Provide concise, helpful responses about our ${businessType.toLowerCase()} services.`,
            initial_message: `Hello! Welcome to ${businessName}. How can we assist you today?`
        },
        contact: {
            phone: phone,
            email: email,
            website: website,
            address: address,
            hours: hours
        },
        services: {
            primary: [],
            specialties: []
        },
        keywords: []
    };
    
    // Create theme.css
    const theme = `:root {
  /* Primary Colors */
  --primary-color: ${primaryColor || '#000000'};
  --primary-hover: ${primaryColor ? lightenColor(primaryColor, 20) : '#333333'};
  --secondary-color: #4A90E2;
  
  /* Text Colors */
  --text-color: #1A1A1A;
  --text-light: #666666;
  
  /* Background Colors */
  --bg-color: #FFFFFF;
  --bg-light: #F5F5F5;
  --bg-medium: #E0E0E0;
  
  /* Border Colors */
  --border-color: #CCCCCC;
  
  /* Chat Colors */
  --chat-bg: #FFFFFF;
  --chat-user-bg: ${primaryColor || '#000000'};
  --chat-user-text: #FFFFFF;
  --chat-bot-bg: #F5F5F5;
  --chat-bot-text: #1A1A1A;
  
  /* Font Settings */
  --font-family: 'Arial', sans-serif;
  --font-size-base: 16px;
  
  /* Button Styles */
  --button-radius: 50px;
  --button-padding: 1.2rem 2.8rem;
  
  /* Chat Widget */
  --widget-icon-color: #FFFFFF;
  --widget-bg-color: ${primaryColor || '#000000'};
  --widget-size: 60px;
  --widget-radius: 50%;
}`;
    
    // Create empty knowledge base
    const knowledgeBase = [];
    
    // Write files
    fs.writeFileSync(path.join(businessDir, 'config.json'), JSON.stringify(config, null, 2));
    fs.writeFileSync(path.join(businessDir, 'theme.css'), theme);
    fs.writeFileSync(path.join(businessDir, 'knowledge_base.json'), JSON.stringify(knowledgeBase, null, 2));
    
    console.log('\n✅ Business setup complete!\n');
    console.log(`📂 Files created in: businesses/${businessId}/`);
    console.log('  - config.json');
    console.log('  - theme.css');
    console.log('  - knowledge_base.json');
    
    // Generate embed code
    const embedCode = `<script src="${website || 'https://your-domain.com'}/public/chatbot-widget.js" data-business-id="${businessId}" data-position="bottom-right" data-color="${primaryColor || '#000000'}"></script>`;
    
    console.log('\n📋 Embed Code:\n');
    console.log(embedCode);
    
    rl.close();
}

// Helper function to lighten a hex color
function lightenColor(hex, percent) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert to RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Lighten
    r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Run the setup
setupNewBusiness();