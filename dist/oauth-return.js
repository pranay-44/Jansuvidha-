const callback=new URL(location.href);
callback.searchParams.set('resume','1');
location.replace(callback.href);
