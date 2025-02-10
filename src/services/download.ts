export async function downloadFile(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch the file: ${response.statusText}`);
	}

	const buffer = await response.arrayBuffer();
	const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

	return base64;
}
