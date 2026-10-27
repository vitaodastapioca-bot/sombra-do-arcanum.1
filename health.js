import {json, isConfigured} from '../lib/arcanum.js';
export function GET(){return json({service:'sombra-arcanum',version:10,ready:isConfigured(),storage:'supabase'});}
