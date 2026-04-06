import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch(process.env.ONEDRIVE_FOLDERS_WEBHOOK!, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch folders from n8n');
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching folders:', error);
        return NextResponse.json({ error: 'Error fetching folders' }, { status: 500 });
    }
}
