const cheerio = require('cheerio')
const https = require('https')
const zlib = require('zlib')
const fs = require('fs')
const os = require('os')
let readline = require('readline')

let root_url = 'www.bilibili.com'
let init_bv = 'BV1L34y18736'
let cur_list = []
let path = []
let is_debug = false

const options = {
    hostname: root_url,
    port: 443,
    path: `/video/${init_bv}`,
    method: 'GET',
    agent: false,
    gzip: true
}

function sleep(time) {
    return new Promise((resolve) => {
        setTimeout(resolve, time)
    })
}

function range() {
    let start = 0
    let end = 0
    if (arguments.length <= 0) {
        return []
    } else if (arguments.length === 1) {
        if (arguments[0] <= 0) {
            return []
        }
        start = 0
        end = arguments[0] - 1
    } else {
        start = arguments[0]
        end = arguments[1]
    }
    if (start > end) {
        let tmp = end
        end = start
        start = tmp
    }
    let arr = []
    for (let i = start; i <= end; ++i) {
        arr.push(i)
    }
    return arr
}

function debugPrint(msg) {
    if (is_debug) {
        process.stdout.write(msg + os.EOL)
    }
}

function getList(data) {
    const $ = cheerio.load(data)
    let list = []
    let q_class = '.video-page-card-small'
    let child_tag_name = 'p'
    // if ($(q_class).length <= 0) {
    //     q_class += '-small'
    //     child_tag_name = 'p'
    // }
    // debugPrint(q_class)
    $(q_class).each((i, el) => {
        let a_tag = $(el).find('.info>a')
        if (/BV/.test(a_tag.attr('href'))) {
            let child_tag = $(a_tag).find(child_tag_name)
            list.push({
                'bv': a_tag.attr('href').match(/BV[^\/]+/)[0],
                'title': child_tag.attr('title').trim()
            })
        }

    })
    return list
}

function singleRequest() {
    return new Promise((reso, reje) => {
        let req = https.request(options, (res) => {
            debugPrint(`status: ${res.statusCode}`)
            let html_data = []

            res.on('data', (chunk) => {
                html_data.push(chunk)
            })

            res.on('end', () => {
                try {
                    debugPrint(`data: get`)
                    let decoded = zlib.gunzipSync(Buffer.concat(html_data)).toString('utf-8')
                    let reco_list = getList(decoded)
                    if (reco_list.length <= 0) {
                        debugPrint('can\'t find')
                        fs.writeFileSync('./dump.txt', decoded)
                    }
                    reso(reco_list)
                } catch (err) {
                    reso(null)
                }
            })
        })
        req.on('error', (err) => {
            reso(null)
        })
        req.end()
    })
}

function readLineAsync(msg) {
    return new Promise((reso, reje) => {
        readline.question(msg, (ans) => {
            reso(ans)
        })
    })
}

function getNumDigits(num) {
    if (num < 10) {
        return 1
    }
    let res = 0
    while (num > 0) {
        res++
        num = Math.floor(num / 10)
    }
    return res
}

function leftPaddingNumber(num, max_len) {
    let head = ''
    for (let i in range(Math.abs(max_len - getNumDigits(num)))) {
        head += ' '
    }
    return `${head}${num}`
}

function getStringWidth(str) {
    let w = 0
    for (let c of str) {
        if (c.match(/[\u0000-\u00ff]/)) {
            w += 1
        } else {
            w += 2
        }
    }
    return w
}

function rightPaddingString(str, max_len) {
    let tail = ''
    for (let i in range(Math.abs(max_len - getStringWidth(str)))) {
        tail += ' '
    }
    return `${str}${tail}`
}

// https://www.zhihu.com/question/381784377/answer/1099438784
class A2B {
    constructor() {
        this.table = 'fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF'
        this.tr = {}
        for (let i of range(58)) {
            this.tr[this.table[i]] = i
        }
        this.s = [11, 10, 3, 8, 4, 6, 2, 9, 5, 7]
        this.xor = 177451812
        this.add = 8728348608
    }
    decipher(x) {
        let r = 0
        for (let i of range(6)) {
            r += this.tr[x[this.s[i]]] * (58 ** i)
        }
        return (r - this.add) ^ this.xor
    }
    encrypt(x) {
        x = (x ^ this.xor) + this.add
        let r = ['B', 'V', '1', , , '4', , '1', , '7']
        for (let i of range(6)) {
            r[this.s[i]] = this.table[Math.floor(x / (58 ** i)) % 58]
        }
        return r.join('')
    }
}

const a2b = new A2B()

function rangeRandom(a, b) {
    return Math.floor(Math.random() * (b - a + 1) + a);
}

function genBV() {
    return a2b.encrypt(rangeRandom(1, 699999999))
}

function testLink(bv) {
    // console.log(`测试BV号: ${bv}`)
    options.path = `/video/${bv}/`
    return new Promise((reso, reje) => {
        let req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                reso({ 'status': false, 'data': {} })
            }
            let html_data = []

            res.on('data', (chunk) => {
                html_data.push(chunk)
            })

            res.on('end', () => {
                try {
                    let decoded = zlib.gunzipSync(Buffer.concat(html_data)).toString('utf-8')
                    const $ = cheerio.load(decoded)
                    if ($('#reco_list').length <= 0) {
                        reso({ 'status': false, 'data': {} })

                    } else {
                        reso({ 'status': true, 'data': { 'bv': bv, 'title': $('h1.video-title').attr('title').trim() } })
                    }
                } catch (err) {
                    reso({ 'status': false, 'data': {} })
                }
            })
        })
        req.on('error', (err) => {
            reso({ 'status': false, 'data': {} })
        })
        req.end()
    })
}

function printList(list) {
    let max_num_len = getNumDigits(list.length)
    let max_title_len = list.map(e => getStringWidth(e.title)).reduce((a, b) => Math.max(a, b))
    list.forEach((item, i) => {
        process.stdout.write(`${leftPaddingNumber(i + 1, max_num_len)}. ${rightPaddingString(item.title, max_title_len)} ${item.bv}` + os.EOL)
    })
}

async function main() {
    try {
        readline = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        init_loop: while (true) {
            let cur_bv = genBV()
            let test_res = await testLink(cur_bv)
            if (test_res.status) {
                path.push(test_res.data)
                break init_loop
            }
        }
        console.time('用时')
        main_loop: while (true) {
            let re_request = 0
            request_loop: while (true) {
                cur_list = await singleRequest()
                if (cur_list !== null) {
                    if (cur_list.length > 0) {
                        break request_loop
                    } else {
                        process.stdout.write('无推荐列表')
                        break main_loop
                    }
                }
                re_request++
                if (re_request >= 5) {
                    console.log('网络不好')
                    break main_loop
                }
            }
            process.stdout.write(`当前视频: ${path[path.length - 1].title}(${path[path.length - 1].bv})` + os.EOL)
            printList(cur_list)

            let input_num = 0
            input_loop: while (true) {
                input_num = await readLineAsync('选序号(0退出)>')
                input_num = parseInt(input_num)
                if (input_num === 0) {
                    break main_loop
                }
                if (input_num > 0 && input_num <= cur_list.length) {
                    break input_loop
                }
            }
            path.push(cur_list[input_num - 1])
            options.path = `/video/${cur_list[input_num - 1].bv}/`
        }
        console.timeEnd('用时')
        process.stdout.write('路径:' + os.EOL)
        printList(path)
        readline.close()
    } catch (err) {
        console.error(err)
    }
}

main()

// let ab = new A2B()
// console.log(ab.decipher('BV1bd4y1t7mY'))
// console.log(ab.encrypt(509567982))